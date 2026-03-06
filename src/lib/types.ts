// Shared types for the entire application

export type ImpactLevel = "HIGH" | "MEDIUM" | "LOW";
export type SalesChannel = "OFFLINE" | "ZOMATO" | "SWIGGY" | "OTHER" | "CALL";

export interface MenuItem {
    id: number;
    name: string;
    price: number;
    cost: number;
    category: string;
    onlinePrice?: number; // Optional different price for online channels
    aliases?: string[];
}

export interface OrderItem {
    menuItemId: number;
    name: string;
    qty: number;
    price: number;
    cost: number;
}

export interface Order {
    id: string;
    items: OrderItem[];
    total: number;
    totalCost: number;
    margin: number;
    timestamp: Date;
    channel: SalesChannel;
    orderNumber?: number | null;
    deliveryAddress?: string;
    city?: string;
    pincode?: string;
    foodTotal?: number;
    deliveryCharge?: number;
    posOrderRef?: string;
}

export interface ChannelCommission {
    channel: SalesChannel;
    label: string;
    commissionPct: number; // 0-100
    enabled: boolean;
}

export interface PriceRecommendation {
    menuItem: MenuItem;
    currentPrice: number;
    suggestedPrice: number;
    suggestedOnlinePrice?: number;
    reason: string;
    estimatedRevenueChange: number;
    estimatedMonthlyImpact: number;
    demandLevel: "high" | "medium" | "low";
    marginLevel: "high" | "medium" | "low";
    orderCount: number;
    offlineMarginPct: number;
    onlineMarginPct: number; // After commission
    confidence: number;
    impactLevel: ImpactLevel;
    reasoning: string[];
    impactedMetrics: string[];
}

export interface ComboRecommendation {
    items: MenuItem[];
    coOccurrenceCount: number;
    totalOrders: number;
    confidence: number;
    suggestedPrice: number;
    individualTotal: number;
    aovIncrease: number;
    reason: string;
    impactLevel: ImpactLevel;
    reasoning: string[];
    impactedMetrics: string[];
    estimatedMonthlyImpact: number;
}

export interface AIInsight {
    type: "opportunity" | "warning" | "insight" | "forecast" | "risk";
    title: string;
    description: string;
    impact?: string;
    priority: "high" | "medium" | "low";
    confidence: number;
    impactLevel: ImpactLevel;
    reasoning: string[];
    impactedMetrics: string[];
}

export interface ChannelMetrics {
    channel: SalesChannel;
    orderCount: number;
    revenue: number;
    avgMargin: number;
    avgOrderValue: number;
    topItems: { name: string; count: number }[];
}

export interface VoiceOrderResult {
    transcript: string;
    language: string;
    detectedItems: OrderItem[];
    unmatchedPhrases: string[];
    confidence: number;
    jsonOutput: object;
}

// ─── Module 2: AI Voice Ordering Copilot Types ────────────────────

export type VoiceIntent =
    | "place_order"
    | "modify_order"
    | "remove_item"
    | "ask_menu"
    | "ask_price"
    | "confirm_order"
    | "cancel_order"
    | "greeting"
    | "unknown";

export interface OrderItemModifier {
    type: "add" | "remove" | "preference";
    value: string; // e.g. "extra cheese", "no onions", "less spicy"
}

export interface VoiceOrderItem {
    menuItemId: number;
    name: string;
    qty: number;
    price: number;
    cost: number;
    modifiers: OrderItemModifier[];
    confidence: number; // 0-1
}

export type ConversationRole = "user" | "ai" | "system";

export interface ConversationMessage {
    id: string;
    role: ConversationRole;
    text: string;
    timestamp: Date;
    intent?: VoiceIntent;
    items?: VoiceOrderItem[];
}

export type VoiceSessionStatus =
    | "idle"
    | "listening"
    | "processing"
    | "items_detected"
    | "clarifying"
    | "confirming"
    | "confirmed"
    | "human_handoff"
    | "error";

export interface ClarificationQuestion {
    phrase: string;
    candidates: MenuItem[];
    resolved: boolean;
}

export interface UpsellSuggestion {
    item: MenuItem;
    reason: string;
    confidence: number;
    marginPct: number;
}

export interface ComboSuggestion {
    items: MenuItem[];
    comboPrice: number;
    individualTotal: number;
    savings: number;
    reason: string;
}

export interface VoiceSessionState {
    status: VoiceSessionStatus;
    messages: ConversationMessage[];
    currentItems: VoiceOrderItem[];
    clarifications: ClarificationQuestion[];
    upsells: UpsellSuggestion[];
    combos: ComboSuggestion[];
    failureCount: number;
    overallConfidence: number;
    language: "en-IN" | "hi-IN";
    orderId: string | null;
}

// ─── Telephony / Call Types ───────────────────────────────────────

export type CallStatus =
    | "idle"
    | "ringing"
    | "greeting"
    | "taking_order"
    | "upselling"
    | "confirming"
    | "confirmed"
    | "ended"
    | "transferred";

export interface CallRecord {
    id: string;
    startTime: Date;
    endTime: Date | null;
    duration: number; // seconds
    status: CallStatus;
    transcript: ConversationMessage[];
    orderItems: VoiceOrderItem[];
    orderId: string | null;
    total: number;
    upsellsOffered: number;
    upsellsAccepted: number;
    language: "en-IN" | "hi-IN";
    callerPhone?: string;
    transferred: boolean;
}

export interface TelephonyConfig {
    provider: "twilio" | "exotel" | "demo";
    accountSid?: string;
    authToken?: string;
    phoneNumber?: string;
    webhookUrl?: string;
    ttsVoice?: string;
    sttLanguage?: string;
    enabled: boolean;
}
