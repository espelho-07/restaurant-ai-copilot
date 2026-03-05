// Shared types for the entire application

export interface MenuItem {
    id: number;
    name: string;
    price: number;
    cost: number;
    category: string;
    aliases?: string[]; // Hindi/Hinglish names for voice matching
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
}

export interface PriceRecommendation {
    menuItem: MenuItem;
    currentPrice: number;
    suggestedPrice: number;
    reason: string;
    estimatedRevenueChange: number; // percentage
    demandLevel: "high" | "medium" | "low";
    marginLevel: "high" | "medium" | "low";
    orderCount: number;
}

export interface ComboRecommendation {
    items: MenuItem[];
    coOccurrenceCount: number;
    totalOrders: number;
    confidence: number; // percentage
    suggestedPrice: number;
    individualTotal: number;
    aovIncrease: number; // percentage
    reason: string;
}

export interface AIInsight {
    type: "opportunity" | "warning" | "insight" | "forecast";
    title: string;
    description: string;
    impact?: string;
    priority: "high" | "medium" | "low";
}

export interface VoiceOrderResult {
    transcript: string;
    language: string;
    detectedItems: OrderItem[];
    unmatchedPhrases: string[];
    confidence: number;
    jsonOutput: object;
}
