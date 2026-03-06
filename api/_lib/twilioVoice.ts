import type { VercelRequest } from "@vercel/node";
import * as Twilio from "twilio";
import {
  type ConversationMessage,
  type MenuItem,
  type Order,
  type OrderItem,
} from "../../src/lib/types.js";
import { processTranscript } from "../../src/lib/voiceEngine.js";
import type { CallSession, RestaurantCandidate } from "./callSessionStore.js";
import { hasBackendSupabaseEnv, supabase } from "./auth.js";

const VoiceResponse = (Twilio as any).twiml?.VoiceResponse || (Twilio as any).default?.twiml?.VoiceResponse;
const fallbackPhone = process.env.RESTAURANT_FALLBACK_PHONE || "";
const DELIVERY_CHARGE = 50;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePhone(value: string): string {
  return String(value || "").replace(/[^\d+]/g, "");
}

function normalizeLocation(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePincode(value: string): string | null {
  const match = String(value || "").match(/\b\d{6}\b/);
  return match?.[0] || null;
}

function extractMissingColumn(errorMessage: string): string | null {
  const schemaCacheMatch = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const doesNotExistMatch = errorMessage.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
  if (doesNotExistMatch?.[1]) return doesNotExistMatch[1];

  return null;
}

function restaurantOptionsText(restaurants: RestaurantCandidate[]): string {
  if (restaurants.length === 0) return "";
  if (restaurants.length === 1) return restaurants[0].name;
  if (restaurants.length === 2) return `${restaurants[0].name} or ${restaurants[1].name}`;
  return `${restaurants[0].name}, ${restaurants[1].name}, or ${restaurants[2].name}`;
}

function chooseRestaurantCandidate(transcript: string, candidates: RestaurantCandidate[]): RestaurantCandidate | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const text = normalizeLocation(transcript);
  if (!text) return null;

  if (/\b(top|best|first|number one|1st|pehla|sabse accha)\b/i.test(text)) {
    return candidates[0];
  }

  let best: RestaurantCandidate | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const name = normalizeLocation(candidate.name);
    const area = normalizeLocation(candidate.area);
    const city = normalizeLocation(candidate.city);

    let score = 0;
    if (name && (text.includes(name) || name.includes(text))) score += 0.9;
    if (area && text.includes(area)) score += 0.5;
    if (city && text.includes(city)) score += 0.2;

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return bestScore >= 0.5 ? best : null;
}

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

function calculateFoodTotal(session: CallSession): number {
  return session.currentItems.reduce((sum, item) => sum + item.qty * item.price, 0);
}

export async function findRestaurantsByLocation(locationInput: string): Promise<RestaurantCandidate[]> {
  if (!hasBackendSupabaseEnv) return [];

  const query = normalizeLocation(locationInput);
  if (!query) return [];

  type RestaurantRow = {
    id: string;
    name: string;
    city?: string | null;
    area?: string | null;
    location?: string | null;
    total_orders?: number | string | null;
  };

  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id,name,city,area,location,total_orders")
      .limit(500);

    if (error) return [];

    const matches = ((data || []) as RestaurantRow[])
      .filter((row) => {
        const city = normalizeLocation(String(row.city || row.location || ""));
        const area = normalizeLocation(String(row.area || ""));
        if (!city && !area) return false;
        return city.includes(query) || area.includes(query) || query.includes(city) || query.includes(area);
      })
      .map((row) => ({
        id: String(row.id),
        name: String(row.name || "Restaurant"),
        city: String(row.city || row.location || ""),
        area: String(row.area || ""),
        totalOrders: Math.max(0, Math.floor(toNumber(row.total_orders, 0))),
      }))
      .sort((a, b) => {
        if (b.totalOrders !== a.totalOrders) return b.totalOrders - a.totalOrders;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 3);

    return matches;
  } catch {
    return [];
  }
}

export async function fetchMenuAndOrders(restaurantId: string): Promise<{ menuItems: MenuItem[]; orders: Order[] }> {
  if (!hasBackendSupabaseEnv) return { menuItems: [], orders: [] };

  const [{ data: menuRows }, { data: orderRows }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id,item_name,selling_price,food_cost,category")
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

async function getNextOrderNumber(restaurantId: string): Promise<number> {
  if (!hasBackendSupabaseEnv) return 1;

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number,order_id")
      .eq("restaurant_id", restaurantId)
      .order("order_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      const latest = toNumber((data as any)?.order_number, 0);
      if (latest > 0) return latest + 1;
      const orderId = String((data as any)?.order_id || "");
      const parsed = Number(orderId.replace(/[^\d]/g, ""));
      if (Number.isFinite(parsed) && parsed > 0) return parsed + 1;
    }
  } catch {
    // fallback below
  }

  try {
    const { data } = await supabase
      .from("orders")
      .select("order_id")
      .eq("restaurant_id", restaurantId)
      .order("timestamp", { ascending: false })
      .limit(200);

    let maxOrder = 0;
    for (const row of data || []) {
      const raw = String((row as any)?.order_id || "");
      const parsed = Number(raw.replace(/[^\d]/g, ""));
      if (Number.isFinite(parsed) && parsed > maxOrder) maxOrder = parsed;
    }

    return maxOrder + 1;
  } catch {
    return 1;
  }
}

function createPosOrderRef(restaurantId: string, orderNumber: number): string {
  const prefix = String(restaurantId || "REST").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "REST";
  return `KOT-${prefix}-${orderNumber}`;
}

async function insertOrderRowsWithFallback(rows: Record<string, unknown>[]): Promise<void> {
  let mutableRows = rows.map((row) => ({ ...row }));

  while (true) {
    const { error } = await supabase.from("orders").insert(mutableRows);
    if (!error) return;

    const missingColumn = extractMissingColumn(error.message || "");
    if (missingColumn && Object.prototype.hasOwnProperty.call(mutableRows[0] || {}, missingColumn)) {
      mutableRows = mutableRows.map((row) => {
        const copy = { ...row };
        delete (copy as any)[missingColumn];
        return copy;
      });
      continue;
    }

    throw new Error(error.message || "Failed to insert order rows");
  }
}

async function insertCallOrder(restaurantId: string, session: CallSession): Promise<{
  orderId: string;
  orderNumber: number;
  total: number;
  foodTotal: number;
  deliveryCharge: number;
  posOrderRef: string;
}> {
  if (!hasBackendSupabaseEnv) {
    throw new Error("Server Supabase env is not configured");
  }

  const orderNumber = session.proposedOrderNumber || await getNextOrderNumber(restaurantId);
  const orderId = `#${orderNumber}`;
  const timestamp = new Date().toISOString();
  const foodTotal = calculateFoodTotal(session);
  const deliveryCharge = session.deliveryCharge || DELIVERY_CHARGE;
  const total = foodTotal + deliveryCharge;
  const posOrderRef = createPosOrderRef(restaurantId, orderNumber);

  const rows = session.currentItems.map((item) => ({
    restaurant_id: restaurantId,
    order_id: orderId,
    order_number: orderNumber,
    item_name: item.name,
    quantity: item.qty,
    channel: "CALL",
    timestamp,
    delivery_address: session.deliveryAddress,
    city: session.selectedCity,
    pincode: session.deliveryPincode,
    food_total: foodTotal,
    delivery_charge: deliveryCharge,
    total_amount: total,
    pos_order_ref: posOrderRef,
  }));

  if (rows.length > 0) {
    await insertOrderRowsWithFallback(rows as Record<string, unknown>[]);
  }

  try {
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("total_orders")
      .eq("id", restaurantId)
      .limit(1)
      .maybeSingle();

    const nextTotalOrders = Math.max(0, Math.floor(toNumber((restaurant as any)?.total_orders, 0))) + 1;

    await supabase
      .from("restaurants")
      .update({ total_orders: nextTotalOrders })
      .eq("id", restaurantId);
  } catch {
    // best effort
  }

  return { orderId, orderNumber, total, foodTotal, deliveryCharge, posOrderRef };
}

export async function persistCallLog(session: CallSession, extras?: {
  status?: string;
  total?: number;
  foodTotal?: number;
  deliveryCharge?: number;
  orderId?: string;
  orderNumber?: number;
  posOrderRef?: string;
  transferred?: boolean;
}): Promise<void> {
  if (!hasBackendSupabaseEnv) return;

  const callStatePayload = {
    items: session.currentItems,
    selected_city: session.selectedCity,
    selected_area: session.selectedArea,
    restaurant_name: session.selectedRestaurantName,
    candidate_restaurants: session.candidateRestaurants,
    delivery_address: session.deliveryAddress,
    delivery_pincode: session.deliveryPincode,
    delivery_charge: extras?.deliveryCharge ?? session.deliveryCharge,
    food_total: extras?.foodTotal ?? calculateFoodTotal(session),
    order_number: extras?.orderNumber ?? session.proposedOrderNumber,
    pos_order_ref: extras?.posOrderRef ?? session.posOrderRef,
  };

  try {
    await supabase.from("call_logs").upsert({
      call_sid: session.callSid,
      restaurant_id: session.restaurantId,
      caller_phone: session.callerPhone,
      to_phone: session.toPhone,
      language: session.language,
      status: extras?.status || session.status,
      transcript: session.transcript,
      detected_items: callStatePayload,
      order_json: callStatePayload,
      order_id: extras?.orderId || session.orderId,
      total: extras?.total ?? calculateFoodTotal(session) + (session.deliveryCharge || DELIVERY_CHARGE),
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
  const greeting = "Hello! Welcome to the AI restaurant ordering assistant. Which city or area are you calling from?";
  addMessage(session, "ai", greeting);
  session.status = "awaiting_location";
  gatherPrompt(response, greeting, baseUrl, session.language);
  response.redirect({ method: "POST" }, `${baseUrl}/api/process-order`);
  return response.toString();
}

function buildRetryPrompt(session: CallSession): string {
  if (session.status === "awaiting_location") {
    return "I did not catch your city or area. Please tell me your city again.";
  }
  if (session.status === "awaiting_restaurant_selection") {
    const options = restaurantOptionsText(session.candidateRestaurants);
    return options
      ? `Please select one restaurant: ${options}.`
      : "Please tell me which restaurant you would like to order from.";
  }
  if (session.status === "awaiting_address") {
    return "Please tell your full delivery address including area and six digit pincode.";
  }
  if (session.status === "awaiting_confirmation") {
    return "Please say yes to place the order, or no to modify your order.";
  }
  return "I did not catch that. Please repeat your order.";
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

    const retryText = buildRetryPrompt(session);
    addMessage(session, "ai", retryText);
    gatherPrompt(response, retryText, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  session.language = chooseLanguageFromSpeech(transcript);
  addMessage(session, "user", transcript);

  if (session.comboPrompted && session.pendingComboItemIds.length > 0) {
    if (isAffirmative(transcript)) {
      const { menuItems } = await fetchMenuAndOrders(session.restaurantId || "");
      for (const comboItemId of session.pendingComboItemIds) {
        const comboItem = menuItems.find((m) => m.id === comboItemId);
        if (!comboItem) continue;
        const existing = session.currentItems.find((item) => item.menuItemId === comboItem.id);
        if (existing) existing.qty += 1;
        else {
          session.currentItems.push({
            menuItemId: comboItem.id,
            name: comboItem.name,
            qty: 1,
            price: comboItem.price,
            cost: comboItem.cost,
            modifiers: [],
            confidence: 1,
          });
        }
      }

      session.pendingComboItemIds = [];
      const comboAdded = "Great, I added the combo items. Anything else?";
      addMessage(session, "ai", comboAdded);
      gatherPrompt(response, comboAdded, baseUrl, session.language);
      return { twiml: response.toString() };
    }

    if (isNegative(transcript)) {
      session.pendingComboItemIds = [];
    }
  }

  if (session.upsellItemId && isNegative(transcript)) {
    session.upsellItemId = null;
  }

  if (session.status === "awaiting_location") {
    const options = await findRestaurantsByLocation(transcript);

    if (options.length === 0) {
      session.failureCount += 1;
      if (session.failureCount >= 3) {
        session.status = "transferred";
        return { twiml: buildTransferResponse(session) };
      }

      const noMatch = "I could not find restaurants in that area. Please tell your city or nearby area again.";
      addMessage(session, "ai", noMatch);
      gatherPrompt(response, noMatch, baseUrl, session.language);
      return { twiml: response.toString() };
    }

    session.failureCount = 0;
    session.selectedCity = options[0].city || transcript;
    session.candidateRestaurants = options;
    session.status = "awaiting_restaurant_selection";

    const top = options[0];
    const alternatives = options.slice(1).map((item) => item.name).join(" or ");
    const cityLabel = top.city || session.selectedCity || "your area";
    const recommendation = alternatives
      ? `I found restaurants in ${cityLabel}. I recommend ${top.name}. You can also order from ${alternatives}. Which restaurant would you like?`
      : `I found ${top.name} in ${cityLabel}. Would you like to order from ${top.name}?`;

    addMessage(session, "ai", recommendation);
    gatherPrompt(response, recommendation, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  if (session.status === "awaiting_restaurant_selection") {
    const selected = chooseRestaurantCandidate(transcript, session.candidateRestaurants);
    if (!selected) {
      session.failureCount += 1;
      if (session.failureCount >= 3) {
        session.status = "transferred";
        return { twiml: buildTransferResponse(session) };
      }

      const options = restaurantOptionsText(session.candidateRestaurants);
      const prompt = options
        ? `Please choose one restaurant from: ${options}.`
        : "Please tell the restaurant name you want to order from.";
      addMessage(session, "ai", prompt);
      gatherPrompt(response, prompt, baseUrl, session.language);
      return { twiml: response.toString() };
    }

    session.failureCount = 0;
    session.restaurantId = selected.id;
    session.selectedRestaurantName = selected.name;
    session.selectedCity = selected.city;
    session.selectedArea = selected.area;
    session.status = "collecting_order";
    session.upsellPrompted = false;
    session.comboPrompted = false;
    session.pendingComboItemIds = [];

    const choosePrompt = `Great! What would you like to order from ${selected.name}?`;
    addMessage(session, "ai", choosePrompt);
    gatherPrompt(response, choosePrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  if (session.status === "awaiting_address") {
    if (transcript.length < 8) {
      const askAgain = "Please share a complete delivery address with area and six digit pincode.";
      addMessage(session, "ai", askAgain);
      gatherPrompt(response, askAgain, baseUrl, session.language);
      return { twiml: response.toString() };
    }

    session.deliveryAddress = transcript;
    session.deliveryPincode = parsePincode(transcript);
    session.foodTotal = calculateFoodTotal(session);
    session.deliveryCharge = DELIVERY_CHARGE;

    if (!session.proposedOrderNumber && session.restaurantId) {
      session.proposedOrderNumber = await getNextOrderNumber(session.restaurantId);
    }

    const orderNumber = session.proposedOrderNumber || 1;
    const total = session.foodTotal + session.deliveryCharge;
    session.status = "awaiting_confirmation";

    const summary = summarizeItems(session.currentItems.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      qty: item.qty,
      price: item.price,
      cost: item.cost,
    })));

    const confirmPrompt = `You ordered ${summary}. Delivery charge is rupees ${session.deliveryCharge}. Total bill is rupees ${total}. Your order number is #${orderNumber}. Should I place the order?`;
    addMessage(session, "ai", confirmPrompt);
    gatherPrompt(response, confirmPrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  if (session.status === "awaiting_confirmation") {
    if (isAffirmative(transcript)) {
      if (!session.restaurantId) {
        const unavailable = "I could not resolve restaurant details. Transferring you to staff.";
        addMessage(session, "ai", unavailable);
        session.status = "transferred";
        return { twiml: buildTransferResponse(session) };
      }

      if (!session.deliveryAddress) {
        session.status = "awaiting_address";
        const addressPrompt = "Please tell me your delivery address before I place the order.";
        addMessage(session, "ai", addressPrompt);
        gatherPrompt(response, addressPrompt, baseUrl, session.language);
        return { twiml: response.toString() };
      }

      const finalized = await insertCallOrder(session.restaurantId, session);
      session.orderId = finalized.orderId;
      session.proposedOrderNumber = finalized.orderNumber;
      session.foodTotal = finalized.foodTotal;
      session.deliveryCharge = finalized.deliveryCharge;
      session.posOrderRef = finalized.posOrderRef;
      session.status = "completed";

      const confirmText = `Your order ${finalized.orderId} has been placed. Total is rupees ${finalized.total}. Kitchen ticket ${finalized.posOrderRef} created. Thank you for calling.`;
      addMessage(session, "ai", confirmText);
      response.say({ language: session.language }, confirmText);
      response.hangup();
      return { twiml: response.toString(), finalize: { orderId: finalized.orderId, total: finalized.total } };
    }

    if (isNegative(transcript)) {
      session.status = "collecting_order";
      session.upsellItemId = null;
      session.pendingComboItemIds = [];
      const editPrompt = "Sure, please tell me the changes to your order.";
      addMessage(session, "ai", editPrompt);
      gatherPrompt(response, editPrompt, baseUrl, session.language);
      return { twiml: response.toString() };
    }
  }

  if (!session.restaurantId) {
    const relaunch = "Before ordering, please tell your city so I can find available restaurants.";
    session.status = "awaiting_location";
    addMessage(session, "ai", relaunch);
    gatherPrompt(response, relaunch, baseUrl, session.language);
    return { twiml: response.toString() };
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
    const msg = "Sorry, that item is not available on our menu.";
    addMessage(session, "ai", msg);

    if (session.failureCount >= 3) {
      session.status = "transferred";
      return { twiml: buildTransferResponse(session) };
    }

    gatherPrompt(response, msg, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  session.failureCount = 0;

  if (result.combos.length > 0 && !session.comboPrompted) {
    const combo = result.combos[0];
    session.comboPrompted = true;
    session.pendingComboItemIds = combo.items.map((item) => item.id);
    const comboPrompt = `We have a combo with ${combo.items.map((item) => item.name).join(", ")} for rupees ${Math.round(combo.comboPrice)}. Would you like that combo?`;
    addMessage(session, "ai", comboPrompt);
    gatherPrompt(response, comboPrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

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
    session.status = "awaiting_address";
    const addressPrompt = "Please tell your delivery address including area and pincode.";
    addMessage(session, "ai", addressPrompt);
    gatherPrompt(response, addressPrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  const aiPrompt = cleanForSpeech(result.aiResponse);
  addMessage(session, "ai", aiPrompt || "Please continue with your order.");
  gatherPrompt(response, aiPrompt || "Please continue with your order.", baseUrl, session.language);
  return { twiml: response.toString() };
}

