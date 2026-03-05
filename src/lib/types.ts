// Shared types for the entire application

export type ImpactLevel = "HIGH" | "MEDIUM" | "LOW";
export type SalesChannel = "OFFLINE" | "ZOMATO" | "SWIGGY" | "OTHER";

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
