import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cleanupExpiredSessions, createOrGetSession, updateSession } from "./_lib/callSessionStore.js";
import {
  buildInitialVoiceResponse,
  getBaseUrl,
  parseFormBody,
  persistCallLog,
  resolveRestaurantId,
} from "./_lib/twilioVoice.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  cleanupExpiredSessions();

  const body = parseFormBody(req);
  const callSid = body.CallSid || body.callSid || `SIM-${Date.now()}`;
  const from = body.From || "";
  const to = body.To || "";

  const session = createOrGetSession(callSid, from, to);
  const restaurantId = await resolveRestaurantId(to);
  updateSession(callSid, { restaurantId });

  const twiml = buildInitialVoiceResponse(session, getBaseUrl(req));
  await persistCallLog(session, { status: "collecting_order" });

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(twiml);
}

