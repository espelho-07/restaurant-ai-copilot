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

function tokenizeSpeech(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
    }
  }

  return matrix[b.length][a.length];
}

function tokenApproximatelyMatches(token: string, keyword: string): boolean {
  if (token === keyword) return true;
  if (token.includes(keyword) || keyword.includes(token)) return true;
  if (token.length >= 4 && keyword.length >= 4 && levenshteinDistance(token, keyword) <= 1) return true;
  return false;
}

function hasApproxKeyword(text: string, keywords: string[]): boolean {
  const tokens = tokenizeSpeech(text);
  for (const token of tokens) {
    for (const keyword of keywords) {
      if (tokenApproximatelyMatches(token, keyword)) {
        return true;
      }
    }
  }
  return false;
}

function isAffirmative(text: string): boolean {
  if (/\b(yes|yep|yeah|haan|ha|bilkul|sahi|confirm|confirmed|place|ok|okay|theek|thik|done|final)\b/i.test(text)) {
    return true;
  }

  return hasApproxKeyword(text, ["confirm", "confirmed", "confoirm", "conform", "place", "yes", "okay", "haan", "bilkul", "done"]);
}

function isNegative(text: string): boolean {
  if (/\b(no|nope|nahi|na|cancel|wrong|galat|mat|stop)\b/i.test(text)) {
    return true;
  }

  return hasApproxKeyword(text, ["no", "nahi", "cancel", "wrong", "galat", "stop"]);
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
    actionOnEmptyResult: true,
    timeout: 6,
    speechTimeout: "auto",
    speechModel: "phone_call",
    language,
    hints: "confirm, yes, no, add, remove, veg burger, burger, coke, naan, butter naan, garlic naan",
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

function extractQuantityFromPhrase(phrase: string): number {
  const normalized = String(phrase || "").toLowerCase();
  const digitMatch = normalized.match(/\b(\d{1,2})\b/);
  if (digitMatch?.[1]) {
    const parsed = Number(digitMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const wordsToQty: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    ek: 1,
    do: 2,
    teen: 3,
    char: 4,
    chaar: 4,
    paanch: 5,
  };

  for (const token of tokenizeSpeech(normalized)) {
    const mapped = wordsToQty[token];
    if (mapped) return mapped;
  }

  return 1;
}

function scoreMenuCandidate(phrase: string, candidate: string): number {
  const source = normalizeLocation(phrase);
  const target = normalizeLocation(candidate);
  if (!source || !target) return 0;

  if (source === target) return 1;
  if (target.includes(source) || source.includes(target)) return 0.88;

  const sourceTokens = tokenizeSpeech(source);
  const targetTokens = tokenizeSpeech(target);

  if (sourceTokens.length === 0 || targetTokens.length === 0) return 0;

  let overlap = 0;
  for (const token of sourceTokens) {
    if (targetTokens.some((candidateToken) => tokenApproximatelyMatches(token, candidateToken))) {
      overlap += 1;
    }
  }

  const tokenScore = overlap / Math.max(sourceTokens.length, targetTokens.length);
  const editScore = 1 - (levenshteinDistance(source, target) / Math.max(source.length, target.length));
  const combined = (tokenScore * 0.75) + (Math.max(0, editScore) * 0.25);
  return Math.max(0, Math.min(1, combined));
}

function getTopMenuAlternatives(phrase: string, menuItems: MenuItem[], limit = 2): { item: MenuItem; score: number }[] {
  return menuItems
    .map((item) => {
      const aliasScores = (item.aliases || []).map((alias) => scoreMenuCandidate(phrase, alias));
      const bestScore = Math.max(scoreMenuCandidate(phrase, item.name), ...aliasScores, 0);
      return { item, score: bestScore };
    })
    .filter((entry) => entry.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));
}

function buildCurrentOrderPrompt(session: CallSession): string {
  if (session.currentItems.length === 0) {
    return "Please tell me your order.";
  }

  const summary = summarizeItems(session.currentItems.map((item) => ({
    menuItemId: item.menuItemId,
    name: item.name,
    qty: item.qty,
    price: item.price,
    cost: item.cost,
  })));

  const total = Math.round(calculateFoodTotal(session));
  return `Current order is ${summary}. Food total is rupees ${total}. You can add more items or say confirm.`;
}

function buildAddedItemsPrompt(previousItems: VoiceOrderItem[], currentItems: VoiceOrderItem[]): string {
  const previousQtyByItem = new Map<number, number>();
  for (const item of previousItems) {
    previousQtyByItem.set(item.menuItemId, (previousQtyByItem.get(item.menuItemId) || 0) + item.qty);
  }

  const addedParts: string[] = [];
  for (const item of currentItems) {
    const beforeQty = previousQtyByItem.get(item.menuItemId) || 0;
    const addedQty = item.qty - beforeQty;
    if (addedQty > 0) {
      addedParts.push(`${addedQty} ${item.name}`);
    }
  }

  if (addedParts.length === 0) return "";
  return `I added ${addedParts.join(", ")}.`;
}

function applyUnmatchedAutoRematch(unmatched: string[], menuItems: MenuItem[], currentItems: VoiceOrderItem[]): string[] {
  const rematched: string[] = [];

  for (const phrase of unmatched) {
    const best = getTopMenuAlternatives(phrase, menuItems, 1)[0];
    if (!best || best.score < 0.82) continue;

    const qty = Math.max(1, extractQuantityFromPhrase(phrase));
    const existing = currentItems.find((item) => item.menuItemId === best.item.id);

    if (existing) {
      existing.qty += qty;
    } else {
      currentItems.push({
        menuItemId: best.item.id,
        name: best.item.name,
        qty,
        price: best.item.price,
        cost: best.item.cost,
        modifiers: [],
        confidence: Math.min(1, best.score),
      });
    }

    rematched.push(best.item.name);
  }

  return rematched;
}

function buildUnavailablePrompt(unmatched: string[], menuItems: MenuItem[]): string {
  if (!unmatched.length) {
    return "Sorry, that item is not available on our menu.";
  }

  const phrase = unmatched[0];
  const alternatives = getTopMenuAlternatives(phrase, menuItems, 2);

  if (alternatives.length >= 2) {
    return `${phrase} is not available. We have ${alternatives[0].item.name} and ${alternatives[1].item.name}. Which one would you like?`;
  }

  if (alternatives.length === 1) {
    return `${phrase} is not available. We have ${alternatives[0].item.name}. Would you like that?`;
  }

  return `${phrase} is not available on our menu. Please choose another item.`;
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

export async function resolveRestaurantForSession(session: CallSession): Promise<boolean> {
  if (!hasBackendSupabaseEnv) return false;
  if (session.restaurantId) return true;

  const assignSessionRestaurant = (source: any) => {
    session.restaurantId = String(source?.id || "").trim();
    if (!session.restaurantId) return false;
    session.selectedRestaurantName = String(source?.name || process.env.RESTAURANT_NAME || "Darpan's Restro");
    session.selectedCity = String(source?.city || "") || null;
    session.selectedArea = String(source?.area || "") || null;
    return true;
  };

  const explicitRestaurant = String(process.env.RESTAURANT_ID || "").trim();
  const explicitLooksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(explicitRestaurant);

  if (explicitRestaurant) {
    try {
      const { data } = await supabase
        .from("restaurants")
        .select("id,name,city,area")
        .eq("id", explicitRestaurant)
        .limit(1)
        .maybeSingle();

      if (data?.id && assignSessionRestaurant(data)) {
        return true;
      }
    } catch {
      // Continue with other fallbacks.
    }
  }

  try {
    const normalizedTo = normalizePhone(session.toPhone || "");
    const { data: rows } = await supabase
      .from("restaurants")
      .select("id,name,city,area,phone,created_at")
      .limit(500);

    const restaurantRows = (rows || []) as any[];
    const matchedByPhone = restaurantRows.find((row) => {
      const dbPhone = normalizePhone(String(row?.phone || ""));
      if (!dbPhone || !normalizedTo) return false;
      return dbPhone === normalizedTo || dbPhone.endsWith(normalizedTo) || normalizedTo.endsWith(dbPhone);
    });

    const selected =
      matchedByPhone ||
      restaurantRows.sort((a, b) => String(a?.created_at || "").localeCompare(String(b?.created_at || "")))[0];

    if (selected?.id && assignSessionRestaurant(selected)) {
      return true;
    }
  } catch {
    // Continue with fallback queries.
  }

  try {
    const { data: menuRows } = await supabase
      .from("menu_items")
      .select("restaurant_id")
      .limit(1);

    const fallbackRestaurantId = String((menuRows as any)?.[0]?.restaurant_id || "").trim();
    if (fallbackRestaurantId && assignSessionRestaurant({ id: fallbackRestaurantId })) {
      return true;
    }
  } catch {
    // No menu fallback available.
  }

  if (explicitRestaurant && explicitLooksUuid && assignSessionRestaurant({ id: explicitRestaurant })) {
    return true;
  }

  return false;
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
  const transferText = fallbackPhone ? "I am transferring your call to our restaurant staff now. Please stay on the line." : "I am transferring your call to our restaurant staff now.";
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

export async function buildInitialVoiceResponse(session: CallSession, baseUrl: string): Promise<string> {
  const response = new VoiceResponse();

  const restaurantResolved = await resolveRestaurantForSession(session);
  if (!restaurantResolved) {
    const unavailable = "Order system is not configured for this number yet. Please call again shortly.";
    addMessage(session, "ai", unavailable);
    response.say({ language: session.language }, unavailable);
    response.hangup();
    return response.toString();
  }

  const greeting = "Hello! Welcome to the AI restaurant ordering assistant. For the hackathon demo and API limits, we are currently taking orders only for Darpan's Restro, and we are using a fixed demo menu. Please tell me your order.";
  addMessage(session, "ai", greeting);
  session.status = "collecting_order";
  gatherPrompt(response, greeting, baseUrl, session.language);
  response.redirect({ method: "POST" }, `${baseUrl}/api/process-order`);
  return response.toString();
}

function buildRetryPrompt(session: CallSession): string {
  if (session.status === "awaiting_address") {
    return "Please tell your full delivery address including area and six digit pincode.";
  }
  if (session.status === "awaiting_confirmation") {
    return "Please say yes or confirm to place the order, or say no to modify your order.";
  }
  if (session.currentItems.length > 0) {
    return "I could not hear that clearly. You can add more items, or say confirm to place the order.";
  }
  return "I could not hear that clearly. Please repeat your order slowly.";
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

  if (!session.restaurantId) {
    const resolved = await resolveRestaurantForSession(session);
    if (!resolved) {
      session.status = "transferred";
      return { twiml: buildTransferResponse(session) };
    }
  }

  const { menuItems, orders } = await fetchMenuAndOrders(session.restaurantId || "");

  if (session.status === "collecting_order" && session.currentItems.length > 0 && isAffirmative(transcript)) {
    session.status = "awaiting_address";
    session.upsellItemId = null;
    session.pendingComboItemIds = [];
    session.comboPrompted = true;
    session.upsellPrompted = true;

    const quickConfirm = "Okay, we are confirming your order. Please tell your delivery address including area and six digit pincode.";
    addMessage(session, "ai", quickConfirm);
    gatherPrompt(response, quickConfirm, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  if (session.comboPrompted && session.pendingComboItemIds.length > 0) {
    if (isAffirmative(transcript)) {
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
      const comboAdded = `Great, I added the combo items. ${buildCurrentOrderPrompt(session)}`;
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

  if (session.status === "awaiting_address") {
    if (isAffirmative(transcript) || isNegative(transcript) || transcript.length < 8) {
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

    const retryConfirm = "Please say yes or confirm to place the order, or say no to modify the order.";
    addMessage(session, "ai", retryConfirm);
    gatherPrompt(response, retryConfirm, baseUrl, session.language);
    return { twiml: response.toString() };
  }

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
      const upsellAdded = `${upsellItem.name} added. ${buildCurrentOrderPrompt(session)}`;
      addMessage(session, "ai", upsellAdded);
      gatherPrompt(response, upsellAdded, baseUrl, session.language);
      return { twiml: response.toString() };
    }

    session.upsellItemId = null;
  }

  const previousItems = session.currentItems.map((item) => ({ ...item, modifiers: [...item.modifiers] }));
  const result = processTranscript(transcript, menuItems, orders, session.currentItems, session.language);
  session.currentItems = result.items;

  if (result.intent === "confirm_order" && session.currentItems.length > 0) {
    session.status = "awaiting_address";
    const addressPrompt = "Okay, we are confirming your order. Please tell your delivery address including area and pincode.";
    addMessage(session, "ai", addressPrompt);
    gatherPrompt(response, addressPrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  if (result.clarifications.length > 0) {
    const clarification = result.clarifications[0];
    const options = clarification.candidates.slice(0, 2).map((item) => item.name);
    const clarifyPrompt = options.length >= 2
      ? `Are you trying to say ${options[0]} or ${options[1]}?`
      : `Are you trying to say ${options[0]}?`;

    addMessage(session, "ai", clarifyPrompt);
    gatherPrompt(response, clarifyPrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  if (result.unmatched.length > 0) {
    const rematched = applyUnmatchedAutoRematch(result.unmatched, menuItems, session.currentItems);
    if (rematched.length > 0) {
      session.failureCount = 0;
      const rematchPrompt = `I think you meant ${rematched.join(" and ")}. ${buildCurrentOrderPrompt(session)}`;
      addMessage(session, "ai", rematchPrompt);
      gatherPrompt(response, rematchPrompt, baseUrl, session.language);
      return { twiml: response.toString() };
    }

    session.failureCount += 1;
    const unavailablePrompt = buildUnavailablePrompt(result.unmatched, menuItems);
    addMessage(session, "ai", unavailablePrompt);

    if (session.failureCount >= 3) {
      session.status = "transferred";
      return { twiml: buildTransferResponse(session) };
    }

    gatherPrompt(response, unavailablePrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  session.failureCount = 0;
  const addedPrompt = buildAddedItemsPrompt(previousItems, session.currentItems);

  if (result.combos.length > 0 && !session.comboPrompted) {
    const combo = result.combos[0];
    session.comboPrompted = true;
    session.pendingComboItemIds = combo.items.map((item) => item.id);
    const comboPrompt = `${addedPrompt ? `${addedPrompt} ` : ""}We have a combo with ${combo.items.map((item) => item.name).join(", ")} for rupees ${Math.round(combo.comboPrice)}. Would you like that combo?`;
    addMessage(session, "ai", comboPrompt);
    gatherPrompt(response, comboPrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  if (result.upsells.length > 0 && !session.upsellPrompted) {
    const upsell = result.upsells[0];
    session.upsellPrompted = true;
    session.upsellItemId = upsell.item.id;
    const upsellPrompt = `${addedPrompt ? `${addedPrompt} ` : ""}Would you like ${upsell.item.name} with your order?`;
    addMessage(session, "ai", upsellPrompt);
    gatherPrompt(response, upsellPrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  if (addedPrompt) {
    const addSummaryPrompt = `${addedPrompt} ${buildCurrentOrderPrompt(session)}`;
    addMessage(session, "ai", addSummaryPrompt);
    gatherPrompt(response, addSummaryPrompt, baseUrl, session.language);
    return { twiml: response.toString() };
  }

  const aiPrompt = cleanForSpeech(result.aiResponse || buildCurrentOrderPrompt(session));
  addMessage(session, "ai", aiPrompt || "Please continue with your order.");
  gatherPrompt(response, aiPrompt || "Please continue with your order.", baseUrl, session.language);
  return { twiml: response.toString() };
}
