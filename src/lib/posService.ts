/**
 * POS Service — Handles API connections with POS systems
 * Supports: Petpooja, POSist, UrbanPiper, and custom/other POS
 *
 * For hackathon demo: Uses realistic simulation matching actual POS API response formats.
 * In production: Would make actual fetch() calls to POS endpoints.
 */

import type { MenuItem, Order, OrderItem } from "./types";

// ─── Types ────────────────────────────────────────────────────────────

export type POSType = "petpooja" | "posist" | "urbanpiper" | "other" | "none";

export interface POSConfig {
  posType: POSType;
  apiBaseUrl: string;
  apiKey: string;
  restaurantId: string;
  secretKey: string;
  autoSync: boolean;
  syncIntervalMinutes: number;
  connected: boolean;
  lastSyncAt?: string;
}

export const defaultPOSConfig: POSConfig = {
  posType: "none",
  apiBaseUrl: "",
  apiKey: "",
  restaurantId: "",
  secretKey: "",
  autoSync: false,
  syncIntervalMinutes: 5,
  connected: false,
};

export interface POSConnectionResult {
  success: boolean;
  message: string;
  restaurantName?: string;
  menuCount?: number;
  orderCount?: number;
}

export interface POSSyncResult {
  menuItems: Omit<MenuItem, "id">[];
  orders: Order[];
  errors: string[];
}

// ─── POS Defaults ─────────────────────────────────────────────────────

export const POS_DEFAULTS: Record<string, { label: string; baseUrl: string; requiresRestaurantId: boolean; requiresSecret: boolean; icon: string }> = {
  petpooja: {
    label: "Petpooja",
    baseUrl: "https://api.petpooja.com/v2",
    requiresRestaurantId: true,
    requiresSecret: false,
    icon: "🟠",
  },
  posist: {
    label: "POSist",
    baseUrl: "https://api.posist.com/v1",
    requiresRestaurantId: true,
    requiresSecret: true,
    icon: "🔵",
  },
  urbanpiper: {
    label: "UrbanPiper",
    baseUrl: "https://api.urbanpiper.com/hub/api/v1",
    requiresRestaurantId: false,
    requiresSecret: true,
    icon: "🟢",
  },
  other: {
    label: "Other POS",
    baseUrl: "",
    requiresRestaurantId: true,
    requiresSecret: false,
    icon: "⚙️",
  },
};

// ─── Simulated POS Data ───────────────────────────────────────────────

const SIMULATED_MENUS: Record<string, Omit<MenuItem, "id">[]> = {
  petpooja: [
    { name: "Butter Chicken", price: 320, cost: 120, category: "Main Course" },
    { name: "Paneer Tikka", price: 260, cost: 90, category: "Starters" },
    { name: "Garlic Naan", price: 60, cost: 15, category: "Breads" },
    { name: "Dal Makhani", price: 220, cost: 60, category: "Main Course" },
    { name: "Chicken Biryani", price: 280, cost: 100, category: "Rice" },
    { name: "Masala Chai", price: 40, cost: 10, category: "Beverages" },
    { name: "Gulab Jamun", price: 80, cost: 25, category: "Desserts" },
    { name: "Tandoori Roti", price: 30, cost: 8, category: "Breads" },
    { name: "Veg Pulao", price: 180, cost: 50, category: "Rice" },
    { name: "Mango Lassi", price: 90, cost: 25, category: "Beverages" },
    { name: "Raita", price: 60, cost: 15, category: "Starters" },
    { name: "Chicken Tikka", price: 240, cost: 85, category: "Starters" },
  ],
  posist: [
    { name: "Margherita Pizza", price: 299, cost: 95, category: "Pizza" },
    { name: "Chicken Burger", price: 199, cost: 70, category: "Burger" },
    { name: "French Fries", price: 120, cost: 30, category: "Snacks" },
    { name: "Pasta Alfredo", price: 249, cost: 80, category: "Main Course" },
    { name: "Cold Coffee", price: 149, cost: 35, category: "Beverages" },
    { name: "Caesar Salad", price: 179, cost: 50, category: "Starters" },
    { name: "Chocolate Shake", price: 169, cost: 40, category: "Beverages" },
    { name: "Garlic Bread", price: 129, cost: 30, category: "Starters" },
    { name: "Paneer Wrap", price: 159, cost: 45, category: "Fast Food" },
    { name: "Brownie", price: 99, cost: 30, category: "Desserts" },
  ],
  urbanpiper: [
    { name: "Schezwan Noodles", price: 180, cost: 55, category: "Chinese" },
    { name: "Manchurian", price: 160, cost: 45, category: "Chinese" },
    { name: "Fried Rice", price: 150, cost: 40, category: "Rice" },
    { name: "Spring Rolls", price: 120, cost: 30, category: "Starters" },
    { name: "Hot & Sour Soup", price: 100, cost: 25, category: "Starters" },
    { name: "Chilli Paneer", price: 200, cost: 65, category: "Chinese" },
    { name: "Hakka Noodles", price: 160, cost: 45, category: "Chinese" },
    { name: "Sweet Corn Soup", price: 90, cost: 20, category: "Starters" },
    { name: "Dragon Chicken", price: 240, cost: 80, category: "Chinese" },
    { name: "Ice Tea", price: 80, cost: 15, category: "Beverages" },
  ],
  other: [
    { name: "Thali Meal", price: 200, cost: 70, category: "Main Course" },
    { name: "Samosa", price: 30, cost: 8, category: "Snacks" },
    { name: "Tea", price: 20, cost: 5, category: "Beverages" },
    { name: "Idli Sambar", price: 80, cost: 20, category: "South Indian" },
    { name: "Dosa", price: 100, cost: 25, category: "South Indian" },
    { name: "Vada Pav", price: 40, cost: 12, category: "Fast Food" },
    { name: "Pav Bhaji", price: 120, cost: 35, category: "Fast Food" },
    { name: "Chole Bhature", price: 140, cost: 40, category: "Main Course" },
  ],
};

function generateSimulatedOrders(menuItems: Omit<MenuItem, "id">[], count: number): Order[] {
  const channels = ["OFFLINE", "ZOMATO", "SWIGGY"] as const;
  const orders: Order[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const numItems = 1 + Math.floor(Math.random() * 3);
    const items: OrderItem[] = [];
    const usedIndices = new Set<number>();

    for (let j = 0; j < numItems; j++) {
      let idx: number;
      do { idx = Math.floor(Math.random() * menuItems.length); } while (usedIndices.has(idx) && usedIndices.size < menuItems.length);
      usedIndices.add(idx);
      const m = menuItems[idx];
      const qty = 1 + Math.floor(Math.random() * 2);
      items.push({ menuItemId: idx + 1, name: m.name, price: m.price, cost: m.cost, qty });
    }

    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const totalCost = items.reduce((s, it) => s + it.cost * it.qty, 0);
    const margin = total > 0 ? ((total - totalCost) / total) * 100 : 0;
    const channel = channels[Math.floor(Math.random() * channels.length)];
    const timestamp = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000);

    orders.push({
      id: `POS-${1000 + i}`,
      items,
      total,
      totalCost,
      margin,
      timestamp,
      channel,
    });
  }

  return orders.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ─── API Methods ──────────────────────────────────────────────────────

export async function testPOSConnection(config: POSConfig): Promise<POSConnectionResult> {
  // Validate required fields
  if (!config.apiKey.trim()) {
    return { success: false, message: "API Key is required." };
  }
  if (config.posType !== "urbanpiper" && !config.restaurantId.trim()) {
    return { success: false, message: "Restaurant ID is required for this POS system." };
  }
  if ((config.posType === "posist" || config.posType === "urbanpiper") && !config.secretKey.trim()) {
    return { success: false, message: "Secret Key is required for this POS system." };
  }
  if (config.posType === "other" && !config.apiBaseUrl.trim()) {
    return { success: false, message: "API Base URL is required for custom POS systems." };
  }

  // Simulate network delay (300-800ms)
  await new Promise(r => setTimeout(r, 300 + Math.random() * 500));

  // Simulate connection scenarios
  if (config.apiKey === "invalid" || config.apiKey.length < 4) {
    return { success: false, message: "Invalid API Key. Please check your credentials and try again." };
  }

  if (config.apiKey === "ratelimit") {
    return { success: false, message: "API rate limit exceeded. Please wait a few minutes and try again." };
  }

  if (config.apiKey === "network") {
    return { success: false, message: "Network error. Could not reach the POS server. Check your internet connection." };
  }

  const posLabel = POS_DEFAULTS[config.posType]?.label || "POS";
  const menu = SIMULATED_MENUS[config.posType] || SIMULATED_MENUS.other;

  return {
    success: true,
    message: `Successfully connected to ${posLabel}! Found ${menu.length} menu items and order history.`,
    restaurantName: `Restaurant #${config.restaurantId || "001"}`,
    menuCount: menu.length,
    orderCount: 15 + Math.floor(Math.random() * 20),
  };
}

export async function fetchMenuFromPOS(config: POSConfig): Promise<{ items: Omit<MenuItem, "id">[]; errors: string[] }> {
  await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

  const items = SIMULATED_MENUS[config.posType] || SIMULATED_MENUS.other;
  return { items, errors: [] };
}

export async function fetchOrdersFromPOS(config: POSConfig): Promise<{ orders: Order[]; errors: string[] }> {
  await new Promise(r => setTimeout(r, 600 + Math.random() * 600));

  const menu = SIMULATED_MENUS[config.posType] || SIMULATED_MENUS.other;
  const count = 15 + Math.floor(Math.random() * 20);
  const orders = generateSimulatedOrders(menu, count);
  return { orders, errors: [] };
}

// ─── Auto-Sync Manager ───────────────────────────────────────────────

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(
  config: POSConfig,
  onMenuSync: (items: Omit<MenuItem, "id">[]) => void,
  onOrderSync: (orders: Order[]) => void,
  onError: (err: string) => void,
): () => void {
  stopAutoSync();

  const intervalMs = (config.syncIntervalMinutes || 5) * 60 * 1000;

  const doSync = async () => {
    try {
      const menuResult = await fetchMenuFromPOS(config);
      if (menuResult.errors.length > 0) {
        onError(`Menu sync errors: ${menuResult.errors.join(", ")}`);
      } else {
        onMenuSync(menuResult.items);
      }

      const orderResult = await fetchOrdersFromPOS(config);
      if (orderResult.errors.length > 0) {
        onError(`Order sync errors: ${orderResult.errors.join(", ")}`);
      } else {
        onOrderSync(orderResult.orders);
      }
    } catch (e) {
      onError(`Sync failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  syncIntervalId = setInterval(doSync, intervalMs);

  // Return cleanup function
  return () => stopAutoSync();
}

export function stopAutoSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
