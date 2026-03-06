import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cleanupExpiredSessions, createOrGetSession } from "./_lib/callSessionStore.js";
import { hasBackendSupabaseEnv } from "./_lib/auth.js";
import {
  buildInitialVoiceResponse,
  getBaseUrl,
  parseFormBody,
  persistCallLog,
} from "./_lib/twilioVoice.js";

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
  const callSid = body.CallSid || body.callSid || `SIM-${Date.now()}`;
  const from = body.From || "";
  const to = body.To || "";

  const session = createOrGetSession(callSid, from, to);

  const twiml = await buildInitialVoiceResponse(session, getBaseUrl(req));
  await persistCallLog(session, { status: "collecting_order" });

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(twiml);
}
