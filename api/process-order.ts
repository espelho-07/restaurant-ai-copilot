import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  cleanupExpiredSessions,
  createOrGetSession,
  deleteSession,
  getSession,
} from "./_lib/callSessionStore.js";
import { hasBackendSupabaseEnv, supabase } from "./_lib/auth.js";
import {
  buildTransferResponse,
  getBaseUrl,
  parseFormBody,
  persistCallLog,
  processSpeechTurn,
  resolveRestaurantId,
} from "./_lib/twilioVoice.js";

async function isCallAlreadyClosed(callSid: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("call_logs")
      .select("status")
      .eq("call_sid", callSid)
      .limit(1)
      .maybeSingle();

    if (error) return false;
    const status = String(data?.status || "").toLowerCase();
    return status === "completed" || status === "transferred";
  } catch {
    return false;
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
  }

  if (!session.restaurantId) {
    const restaurantId = await resolveRestaurantId(to || session.toPhone);
    session.restaurantId = restaurantId;
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
      });
      deleteSession(callSid);
    } else {
      await persistCallLog(session, { status: session.status });
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
