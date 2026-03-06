import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ConversationMessage, VoiceOrderItem } from "../src/lib/types.js";
import type { RestaurantCandidate } from "./_lib/callSessionStore.js";
import {
  cleanupExpiredSessions,
  createOrGetSession,
  deleteSession,
  getSession,
  type CallFlowStatus,
  updateSession,
} from "./_lib/callSessionStore.js";
import { hasBackendSupabaseEnv, supabase } from "./_lib/auth.js";
import {
  buildTransferResponse,
  getBaseUrl,
  parseFormBody,
  persistCallLog,
  processSpeechTurn,
} from "./_lib/twilioVoice.js";

type CallLogStateRow = {
  status?: string | null;
  language?: string | null;
  transcript?: unknown;
  order_json?: unknown;
  detected_items?: unknown;
  order_id?: string | null;
  restaurant_id?: string | null;
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function coerceOrderItems(raw: unknown): VoiceOrderItem[] {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray((toObject(raw) || {}).items)
      ? ((toObject(raw) || {}).items as unknown[])
      : [];

  return source
    .map((item) => ({
      menuItemId: toNumber((item as any)?.menuItemId, 0),
      name: String((item as any)?.name || "").trim(),
      qty: Math.max(1, toNumber((item as any)?.qty, 1)),
      price: toNumber((item as any)?.price, 0),
      cost: toNumber((item as any)?.cost, 0),
      modifiers: Array.isArray((item as any)?.modifiers)
        ? (item as any).modifiers.filter((m: any) => typeof m?.type === "string" && typeof m?.value === "string")
        : [],
      confidence: toNumber((item as any)?.confidence, 0.7),
    }))
    .filter((item) => item.menuItemId > 0 && item.name.length > 0);
}

function coerceTranscript(raw: unknown): ConversationMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((msg) => {
      const role = (msg as any)?.role;
      if (role !== "user" && role !== "ai" && role !== "system") return null;

      const ts = (msg as any)?.timestamp;
      const date = ts ? new Date(ts) : new Date();

      return {
        id: String((msg as any)?.id || `rehydrated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        role,
        text: String((msg as any)?.text || ""),
        timestamp: Number.isNaN(date.getTime()) ? new Date() : date,
      } as ConversationMessage;
    })
    .filter(Boolean) as ConversationMessage[];
}

function coerceCandidates(raw: unknown): RestaurantCandidate[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => ({
      id: String((entry as any)?.id || ""),
      name: String((entry as any)?.name || ""),
      city: String((entry as any)?.city || ""),
      area: String((entry as any)?.area || ""),
      totalOrders: Math.max(0, Math.floor(toNumber((entry as any)?.totalOrders, 0))),
    }))
    .filter((entry) => entry.id.length > 0 && entry.name.length > 0);
}

function asCallFlowStatus(value: unknown): CallFlowStatus {
  const v = String(value || "").toLowerCase();
  if (
    v === "awaiting_location"
    || v === "awaiting_restaurant_selection"
    || v === "collecting_order"
    || v === "awaiting_address"
    || v === "awaiting_confirmation"
    || v === "completed"
    || v === "transferred"
  ) {
    return v;
  }
  return "awaiting_location";
}

async function isCallAlreadyClosed(callSid: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("call_logs")
      .select("status")
      .eq("call_sid", callSid)
      .limit(1)
      .maybeSingle();

    if (error) return false;
    const status = String((data as any)?.status || "").toLowerCase();
    return status === "completed" || status === "transferred";
  } catch {
    return false;
  }
}

async function hydrateSessionFromCallLog(callSid: string): Promise<CallLogStateRow | null> {
  try {
    const { data, error } = await supabase
      .from("call_logs")
      .select("status,language,transcript,order_json,detected_items,order_id,restaurant_id")
      .eq("call_sid", callSid)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as CallLogStateRow;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  cleanupExpiredSessions();

  if (!hasBackendSupabaseEnv) {
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Order system is temporarily unavailable. Please call again shortly.</Say><Hangup/></Response>',
    );
  }

  const body = parseFormBody(req);
  const callSid = body.CallSid || body.callSid;

  if (!callSid) {
    return res.status(400).json({ error: "Missing CallSid" });
  }

  const from = body.From || "";
  const to = body.To || "";

  let session = getSession(callSid);
  if (!session) {
    const alreadyClosed = await isCallAlreadyClosed(callSid);
    if (alreadyClosed) {
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
    }

    session = createOrGetSession(callSid, from, to);

    // Vercel serverless instances are stateless; restore in-progress call state from DB if available.
    const persisted = await hydrateSessionFromCallLog(callSid);
    if (persisted) {
      const statePayload = toObject(persisted.detected_items) || toObject(persisted.order_json) || {};
      const sessionLanguage: "en-IN" | "hi-IN" = persisted.language === "hi-IN" ? "hi-IN" : "en-IN";

      const patch = {
        status: asCallFlowStatus(persisted.status),
        language: sessionLanguage,
        transcript: coerceTranscript(persisted.transcript),
        currentItems: coerceOrderItems(persisted.order_json),
        orderId: persisted.order_id ? String(persisted.order_id) : null,
        restaurantId: persisted.restaurant_id ? String(persisted.restaurant_id) : null,
        selectedCity: String(statePayload.selected_city || "") || null,
        selectedArea: String(statePayload.selected_area || "") || null,
        selectedRestaurantName: String(statePayload.restaurant_name || "") || null,
        candidateRestaurants: coerceCandidates(statePayload.candidate_restaurants),
        deliveryAddress: String(statePayload.delivery_address || "") || null,
        deliveryPincode: String(statePayload.delivery_pincode || "") || null,
        deliveryCharge: toNumber(statePayload.delivery_charge, 50),
        foodTotal: toNumber(statePayload.food_total, 0),
        proposedOrderNumber: statePayload.order_number === undefined ? null : Math.max(1, Math.floor(toNumber(statePayload.order_number, 1))),
        posOrderRef: String(statePayload.pos_order_ref || "") || null,
      };
      const hydrated = updateSession(callSid, patch);
      if (hydrated) session = hydrated;
    }
  }

  if (!session.toPhone) {
    session.toPhone = to;
  }

  const speechResult = body.SpeechResult || "";

  try {
    const turn = await processSpeechTurn({
      session,
      speechResult,
      baseUrl: getBaseUrl(req),
    });

    if (turn.finalize) {
      await persistCallLog(session, {
        status: "completed",
        total: turn.finalize.total,
        orderId: turn.finalize.orderId,
        orderNumber: session.proposedOrderNumber || undefined,
        deliveryCharge: session.deliveryCharge,
        foodTotal: session.foodTotal,
        posOrderRef: session.posOrderRef || undefined,
      });
      deleteSession(callSid);
    } else {
      await persistCallLog(session, {
        status: session.status,
        orderNumber: session.proposedOrderNumber || undefined,
        deliveryCharge: session.deliveryCharge,
        foodTotal: session.foodTotal,
        posOrderRef: session.posOrderRef || undefined,
      });
      if (session.status === "transferred") {
        deleteSession(callSid);
      }
    }

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(turn.twiml);
  } catch {
    await persistCallLog(session, { status: "transferred", transferred: true });
    session.status = "transferred";
    deleteSession(callSid);
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(buildTransferResponse(session));
  }
}
