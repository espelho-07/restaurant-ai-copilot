import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import * as Twilio from "twilio";
import {
  type ConversationMessage,
  type MenuItem,
  type Order,
  type OrderItem,
} from "../../src/lib/types";
import { processTranscript } from "../../src/lib/voiceEngine";
import type { CallSession } from "./callSessionStore";

const VoiceResponse = (Twilio as any).twiml?.VoiceResponse || (Twilio as any).default?.twiml?.VoiceResponse;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const fallbackPhone = process.env.RESTAURANT_FALLBACK_PHONE || "";

const supabase = createClient(supabaseUrl, supabaseKey);

export function parseFormBody(req: VercelRequest): Record<string, string> {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    const parsed = new URLSearchParams(req.body);
    return Object.fromEntries(parsed.entries());
  }

  if (typeof req.body === "object") {
    const body = req.body as Record<string, unknown>;
    const output: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v === null || v === undefined) continue;
      output[k] = String(v);
    }
    return output;
  }

  return {};
}

export function getBaseUrl(req: VercelRequest): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return `${proto}://${host}`;
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAffirmative(text: string): boolean {
  return /\b(yes|yep|yeah|haan|ha|bilkul|sahi|confirm|place|ok|okay|theek|thik)\b/i.test(text);
}

function isNegative(text: string): boolean {
  return /\b(no|nope|nahi|na|cancel|wrong|galat|mat)\b/i.test(text);
}

function chooseLanguageFromSpeech(transcript: string): "en-IN" | "hi-IN" {
  if (/[\u0900-\u097F]/.test(transcript)) return "hi-IN";
  return "en-IN";
}

function addMessage(session: CallSession, role: "user" | "ai" | "system", text: string): void {
  const message: ConversationMessage = {
    id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    timestamp: new Date(),
  };
  session.transcript.push(message);
}

function gatherPrompt(response: InstanceType<typeof VoiceResponse>, prompt: string, baseUrl: string, language: "en-IN" | "hi-IN") {
  const gather = response.gather({
    input: ["speech"],
    method: "POST",
    action: `${baseUrl}/api/process-order`,
    speechTimeout: "auto",
    language,
  });
  gather.say({ language }, cleanForSpeech(prompt));
}

function summarizeItems(items: OrderItem[]): string {
  if (items.length === 0) return "";
  return items.map((item) => `${item.qty} ${item.name}`).join(", ");
}

export async function resolveRestaurantId(phoneNumber: string): Promise<string | null> {
  const explicitRestaurant = process.env.RESTAURANT_ID;
  if (explicitRestaurant) return explicitRestaurant;

  try {
    const { data: byPhone } = await supabase
      .from("restaurants")
      .select("id")
      .eq("phone", phoneNumber)
      .limit(1)
      .maybeSingle();

    if (byPhone?.id) return String(byPhone.id);
  } catch {
    // fall through
  }

  try {
    const { data: firstRestaurant } = await supabase
      .from("restaurants")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (firstRestaurant?.id) return String(firstRestaurant.id);
  } catch {
    // no-op
  }

  return null;
}

export async function fetchMenuAndOrders(restaurantId: string): Promise<{ menuItems: MenuItem[]; orders: Order[] }> {
  const [{ data: menuRows }, { data: orderRows }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id,item_name,selling_price,food_cost,category,aliases")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("orders")
      .select("order_id,item_name,quantity,channel,timestamp")
      .eq("restaurant_id", restaurantId)
      .order("timestamp", { ascending: false })
      .limit(1000),
  ]);

  type MenuRow = {
    id: number | string;
    item_name: string;
    selling_price?: number | string | null;
    food_cost?: number | string | null;
    category?: string | null;
    aliases?: string[] | null;
  };

  type OrderRow = {
    order_id: string;
    item_name: string;
    quantity?: number | string | null;
    channel?: string | null;
    timestamp?: string | null;
  };

  const typedMenuRows = (menuRows || []) as MenuRow[];
  const typedOrderRows = (orderRows || []) as OrderRow[];

  const menuItems: MenuItem[] = typedMenuRows.map((row) => ({
    id: Number(row.id),
    name: String(row.item_name),
    price: Number(row.selling_price || 0),
    cost: Number(row.food_cost || 0),
    category: String(row.category || "General"),
    aliases: Array.isArray(row.aliases) ? row.aliases : undefined,
  }));

  const menuByName = new Map(menuItems.map((m) => [m.name.toLowerCase(), m]));
  const grouped = new Map<string, OrderRow[]>();

  for (const row of typedOrderRows) {
    const key = String(row.order_id || "");
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const orders: Order[] = [];
  for (const [orderId, rows] of grouped.entries()) {
    const items: OrderItem[] = rows
      .map((row) => {
        const matched = menuByName.get(String(row.item_name || "").toLowerCase());
        if (!matched) return null;
        return {
          menuItemId: matched.id,
          name: matched.name,
          qty: Number(row.quantity || 1),
          price: matched.price,
          cost: matched.cost,
        };
      })
      .filter(Boolean) as OrderItem[];

    const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const totalCost = items.reduce((sum, item) => sum + item.qty * item.cost, 0);

    orders.push({
      id: orderId,
      items,
      total,
      totalCost,
      margin: total > 0 ? ((total - totalCost) / total) * 100 : 0,
      timestamp: new Date(rows[0]?.timestamp || new Date().toISOString()),
      channel: (rows[0]?.channel || "OFFLINE") as Order["channel"],
    });
  }

  return { menuItems, orders };
}

async function insertCallOrder(restaurantId: string, session: CallSession): Promise<{ orderId: string; total: number }> {
  const orderId = `CALL-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const rows = session.currentItems.map((item) => ({
    restaurant_id: restaurantId,
    order_id: orderId,
    item_name: item.name,
    quantity: item.qty,
    channel: "CALL",
    timestamp,
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("orders").insert(rows);
    if (error) throw new Error(error.message);
  }

  const total = session.currentItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  return { orderId, total };
}

export async function persistCallLog(session: CallSession, extras?: { status?: string; total?: number; orderId?: string; transferred?: boolean }): Promise<void> {
  try {
    await supabase.from("call_logs").upsert({
      call_sid: session.callSid,
      restaurant_id: session.restaurantId,
      caller_phone: session.callerPhone,
      to_phone: session.toPhone,
      language: session.language,
      status: extras?.status || session.status,
      transcript: session.transcript,
      order_json: session.currentItems,
      order_id: extras?.orderId || session.orderId,
      total: extras?.total ?? session.currentItems.reduce((sum, item) => sum + item.price * item.qty, 0),
      is_transferred: extras?.transferred || session.status === "transferred",
      started_at: session.startedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "call_sid" });
  } catch {
    // Optional persistence table.
  }
}

export function buildTransferResponse(session: CallSession): string {
  const response = new VoiceResponse();
  const transferText = "I am transferring your call to our restaurant staff now.";
  addMessage(session, "ai", transferText);
  response.say({ language: session.language }, transferText);

  if (fallbackPhone) {
    response.dial(fallbackPhone);
  } else {
    response.say({ language: session.language }, "Our team is unavailable at the moment. Please call again shortly.");
    response.hangup();
  }

  return response.toString();
}

export function buildInitialVoiceResponse(session: CallSession, baseUrl: string): string {
  const response = new VoiceResponse();
  const greeting = "Hello, welcome to the AI restaurant ordering system. Please tell me your order.";
  addMessage(session, "ai", greeting);
  gatherPrompt(response, greeting, baseUrl, session.language);
  response.redirect({ method: "POST" }, `${baseUrl}/api/process-order`);
  return response.toString();
}

export async function processSpeechTurn(params: {
  session: CallSession;
  speechResult: string;
  baseUrl: string;
}): Promise<{ twiml: string; finalize?: { orderId: string; total: number } }> {
  const { session, speechResult, baseUrl } = params;
  const response = new VoiceResponse();
  const transcript = (speechResult || "").trim();

  if (!transcript) {
    session.failureCount += 1;
    if (session.failureCount >= 3) {
      session.status = "transferred";
      return { twiml: buildTransferResponse(session) };
    }

    const retryText = "I did not catch that. Please repeat your order.";
    addMessage(session, "ai", retryText);
    gatherPrompt(response, retryText, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  session.language = chooseLanguageFromSpeech(transcript);
  addMessage(session, "user", transcript);

  if (session.upsellItemId && isNegative(transcript)) {
    session.upsellItemId = null;
  }

  if (session.status === "awaiting_confirmation") {
    if (isAffirmative(transcript)) {
      if (!session.restaurantId) {
        const unavailable = "We are unable to place this order right now. Transferring you to staff.";
        addMessage(session, "ai", unavailable);
        session.status = "transferred";
        return { twiml: buildTransferResponse(session) };
      }

      const finalized = await insertCallOrder(session.restaurantId, session);
      session.orderId = finalized.orderId;
      session.status = "completed";

      const confirmText = `Your order has been placed. Order ID ${finalized.orderId}. Thank you for calling.`;
      addMessage(session, "ai", confirmText);
      response.say({ language: session.language }, confirmText);
      response.hangup();
      return { twiml: response.toString(), finalize: finalized };
    }

    if (isNegative(transcript)) {
      session.status = "collecting_order";
      const editPrompt = "Sure, please tell me the changes to your order.";
      addMessage(session, "ai", editPrompt);
      gatherPrompt(response, editPrompt, baseUrl, session.language);
      return { twiml: response.toString() };
    }
  }

  if (!session.restaurantId) {
    const unavailable = "Order system is temporarily unavailable. Let me transfer your call to our staff.";
    addMessage(session, "ai", unavailable);
    session.status = "transferred";
    return { twiml: buildTransferResponse(session) };
  }

  const { menuItems, orders } = await fetchMenuAndOrders(session.restaurantId);

  if (session.upsellItemId && isAffirmative(transcript)) {
    const upsellItem = menuItems.find((item) => item.id === session.upsellItemId);
    if (upsellItem) {
      const existing = session.currentItems.find((item) => item.menuItemId === upsellItem.id);
      if (existing) {
        existing.qty += 1;
      } else {
        session.currentItems.push({
          menuItemId: upsellItem.id,
          name: upsellItem.name,
          qty: 1,
          price: upsellItem.price,
          cost: upsellItem.cost,
          modifiers: [],
          confidence: 1,
        });
      }

      session.upsellItemId = null;
      const upsellAdded = `${upsellItem.name} added. Anything else?`;
      addMessage(session, "ai", upsellAdded);
      gatherPrompt(response, upsellAdded, baseUrl, session.language);
      return { twiml: response.toString() };
    }

    session.upsellItemId = null;
  }

  const result = processTranscript(transcript, menuItems, orders, session.currentItems, session.language);
  session.currentItems = result.items;

  if (result.unmatched.length > 0) {
    session.failureCount += 1;
    const msg = `Sorry, that item is not available on our menu.`;
    addMessage(session, "ai", msg);

    if (session.failureCount >= 3) {
      session.status = "transferred";
      return { twiml: buildTransferResponse(session) };
    }

    gatherPrompt(response, msg, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  session.failureCount = 0;

  if (result.upsells.length > 0 && !session.upsellPrompted) {
    const upsell = result.upsells[0];
    session.upsellPrompted = true;
    session.upsellItemId = upsell.item.id;
    const upsellPrompt = `Would you like ${upsell.item.name} with your order?`;
    addMessage(session, "ai", upsellPrompt);
    gatherPrompt(response, upsellPrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  if (result.intent === "confirm_order" && session.currentItems.length > 0) {
    session.status = "awaiting_confirmation";
    const summary = summarizeItems(session.currentItems.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      qty: item.qty,
      price: item.price,
      cost: item.cost,
    })));
    const total = session.currentItems.reduce((sum, item) => sum + item.qty * item.price, 0);
    const confirmPrompt = `You ordered ${summary}. Total is rupees ${total}. Should I place the order?`;
    addMessage(session, "ai", confirmPrompt);
    gatherPrompt(response, confirmPrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  const aiPrompt = cleanForSpeech(result.aiResponse);
  addMessage(session, "ai", aiPrompt || "Please continue with your order.");
  gatherPrompt(response, aiPrompt || "Please continue with your order.", baseUrl, session.language);
  return { twiml: response.toString() };
}




