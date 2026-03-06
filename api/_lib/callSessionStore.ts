import type { ConversationMessage, VoiceOrderItem } from "../../src/lib/types.js";

export type CallFlowStatus =
  | "awaiting_location"
  | "awaiting_restaurant_selection"
  | "collecting_order"
  | "awaiting_address"
  | "awaiting_confirmation"
  | "completed"
  | "transferred";

export interface RestaurantCandidate {
  id: string;
  name: string;
  city: string;
  area: string;
  totalOrders: number;
}

export interface CallSession {
  callSid: string;
  callerPhone: string;
  toPhone: string;
  startedAt: string;
  updatedAt: string;
  language: "en-IN" | "hi-IN";
  status: CallFlowStatus;
  currentItems: VoiceOrderItem[];
  transcript: ConversationMessage[];
  failureCount: number;
  upsellItemId: number | null;
  upsellPrompted: boolean;
  comboPrompted: boolean;
  pendingComboItemIds: number[];
  orderId: string | null;
  restaurantId: string | null;
  selectedRestaurantName: string | null;
  selectedCity: string | null;
  selectedArea: string | null;
  candidateRestaurants: RestaurantCandidate[];
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  foodTotal: number;
  deliveryCharge: number;
  proposedOrderNumber: number | null;
  posOrderRef: string | null;
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, CallSession>();

function nowIso() {
  return new Date().toISOString();
}

export function createOrGetSession(callSid: string, callerPhone: string, toPhone: string): CallSession {
  const existing = sessions.get(callSid);
  if (existing) {
    existing.updatedAt = nowIso();
    return existing;
  }

  const session: CallSession = {
    callSid,
    callerPhone,
    toPhone,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    language: "en-IN",
    status: "awaiting_location",
    currentItems: [],
    transcript: [],
    failureCount: 0,
    upsellItemId: null,
    upsellPrompted: false,
    comboPrompted: false,
    pendingComboItemIds: [],
    orderId: null,
    restaurantId: null,
    selectedRestaurantName: null,
    selectedCity: null,
    selectedArea: null,
    candidateRestaurants: [],
    deliveryAddress: null,
    deliveryPincode: null,
    foodTotal: 0,
    deliveryCharge: 50,
    proposedOrderNumber: null,
    posOrderRef: null,
  };

  sessions.set(callSid, session);
  return session;
}

export function getSession(callSid: string): CallSession | null {
  const session = sessions.get(callSid);
  if (!session) return null;
  session.updatedAt = nowIso();
  return session;
}

export function updateSession(callSid: string, patch: Partial<CallSession>): CallSession | null {
  const session = sessions.get(callSid);
  if (!session) return null;
  Object.assign(session, patch);
  session.updatedAt = nowIso();
  return session;
}

export function deleteSession(callSid: string): void {
  sessions.delete(callSid);
}

export function cleanupExpiredSessions(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [sid, session] of sessions.entries()) {
    if (new Date(session.updatedAt).getTime() < cutoff) {
      sessions.delete(sid);
    }
  }
}
