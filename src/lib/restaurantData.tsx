import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { MenuItem, Order, OrderItem, SalesChannel, ChannelCommission } from "./types";

// ─── LOCALSTORAGE KEYS ────────────────────────────────────────────

const STORAGE_KEYS = {
    menuItems: "rc_menu_items",
    orders: "rc_orders",
    restaurantProfile: "rc_restaurant_profile",
    nextId: "rc_next_id",
    commissions: "rc_commissions",
};

// ─── SEED DATA ────────────────────────────────────────────────────

const seedMenuItems: MenuItem[] = [
    { id: 1, name: "Butter Chicken", price: 320, cost: 110, category: "Main Course", aliases: ["butter chicken", "murgh makhani"] },
    { id: 2, name: "Paneer Tikka", price: 260, cost: 125, category: "Starters", aliases: ["paneer tikka", "tikka paneer"] },
    { id: 3, name: "Chicken Biryani", price: 280, cost: 180, category: "Main Course", aliases: ["biryani", "chicken biryani", "biriyani"] },
    { id: 4, name: "Veg Burger", price: 180, cost: 60, category: "Fast Food", aliases: ["veg burger", "burger", "veggie burger"] },
    { id: 5, name: "Masala Dosa", price: 150, cost: 45, category: "South Indian", aliases: ["masala dosa", "dosa"] },
    { id: 6, name: "Dal Makhani", price: 200, cost: 65, category: "Main Course", aliases: ["dal makhani", "dal", "daal"] },
    { id: 7, name: "French Fries", price: 120, cost: 35, category: "Snacks", aliases: ["french fries", "fries", "finger chips"] },
    { id: 8, name: "Coke", price: 60, cost: 20, category: "Beverages", aliases: ["coke", "cola", "coca cola", "cold drink"] },
    { id: 9, name: "Gulab Jamun", price: 80, cost: 20, category: "Desserts", aliases: ["gulab jamun", "gulab", "jamun"] },
    { id: 10, name: "Butter Naan", price: 50, cost: 12, category: "Breads", aliases: ["butter naan", "naan", "nan"] },
    { id: 11, name: "Lassi", price: 90, cost: 25, category: "Beverages", aliases: ["lassi", "sweet lassi", "meethi lassi"] },
    { id: 12, name: "Fish Fry", price: 350, cost: 220, category: "Starters", aliases: ["fish fry", "fried fish", "machli"] },
];

const defaultCommissions: ChannelCommission[] = [
    { channel: "OFFLINE", label: "Offline / Dine-in", commissionPct: 0, enabled: true },
    { channel: "ZOMATO", label: "Zomato", commissionPct: 25, enabled: true },
    { channel: "SWIGGY", label: "Swiggy", commissionPct: 22, enabled: true },
    { channel: "OTHER", label: "Other Online", commissionPct: 15, enabled: false },
];

function generateSeedOrders(menu: MenuItem[]): Order[] {
    const orders: Order[] = [];
    const channels: SalesChannel[] = ["OFFLINE", "ZOMATO", "SWIGGY", "OFFLINE", "OFFLINE"];
    const combos = [
        [1, 10, 11], [4, 7, 8], [3, 10], [1, 10, 9], [4, 8],
        [5, 11], [6, 10], [2, 10, 11], [4, 7], [1, 6, 10],
        [3, 8], [12, 8], [2, 8], [5, 8], [4, 7, 8],
        [1, 10], [4, 7, 8], [1, 10, 11], [6, 10, 9], [3, 10, 8],
    ];
    const now = Date.now();
    combos.forEach((itemIds, i) => {
        const items: OrderItem[] = itemIds.map((id) => {
            const m = menu.find((mi) => mi.id === id)!;
            const qty = Math.random() > 0.7 ? 2 : 1;
            return { menuItemId: m.id, name: m.name, qty, price: m.price, cost: m.cost };
        });
        const total = items.reduce((s, it) => s + it.price * it.qty, 0);
        const totalCost = items.reduce((s, it) => s + it.cost * it.qty, 0);
        orders.push({
            id: `SEED-${1000 + i}`,
            items, total, totalCost,
            margin: ((total - totalCost) / total) * 100,
            timestamp: new Date(now - (combos.length - i) * 3600000 * Math.random() * 24),
            channel: channels[i % channels.length],
        });
    });
    return orders;
}

// ─── LOCALSTORAGE HELPERS ─────────────────────────────────────────

function loadFromStorage<T>(key: string, fallback: T): T {
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (key === STORAGE_KEYS.orders && Array.isArray(parsed)) {
                return parsed.map((o: any) => ({ ...o, channel: o.channel || "OFFLINE", timestamp: new Date(o.timestamp) })) as unknown as T;
            }
            return parsed;
        }
    } catch { /* corrupted — fall through */ }
    return fallback;
}

function saveToStorage<T>(key: string, value: T): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or unavailable */ }
}

// ─── RESTAURANT PROFILE ──────────────────────────────────────────

export interface RestaurantProfile {
    name: string;
    location: string;
    cuisine: string;
    usesPOS: boolean;
    setupComplete: boolean;
}

const defaultProfile: RestaurantProfile = {
    name: "", location: "", cuisine: "", usesPOS: false, setupComplete: false,
};

// ─── CONTEXT ──────────────────────────────────────────────────────

interface RestaurantDataContextType {
    menuItems: MenuItem[];
    orders: Order[];
    profile: RestaurantProfile;
    commissions: ChannelCommission[];
    addMenuItem: (item: Omit<MenuItem, "id">) => void;
    addOrder: (items: OrderItem[], channel?: SalesChannel) => Order;
    importMenuItems: (items: Omit<MenuItem, "id">[]) => { added: number; duplicates: number };
    importOrders: (newOrders: Order[]) => number;
    updateProfile: (updates: Partial<RestaurantProfile>) => void;
    updateCommission: (channel: SalesChannel, updates: Partial<ChannelCommission>) => void;
    getCommission: (channel: SalesChannel) => number;
    resetData: () => void;
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
}

const RestaurantDataContext = createContext<RestaurantDataContextType | null>(null);

export function RestaurantDataProvider({ children }: { children: React.ReactNode }) {
    const [menuItems, setMenuItems] = useState<MenuItem[]>(() => loadFromStorage(STORAGE_KEYS.menuItems, seedMenuItems));
    const [orders, setOrders] = useState<Order[]>(() => loadFromStorage(STORAGE_KEYS.orders, generateSeedOrders(seedMenuItems)));
    const [profile, setProfile] = useState<RestaurantProfile>(() => loadFromStorage(STORAGE_KEYS.restaurantProfile, defaultProfile));
    const [commissions, setCommissions] = useState<ChannelCommission[]>(() => loadFromStorage(STORAGE_KEYS.commissions, defaultCommissions));
    const [nextId, setNextId] = useState<number>(() => loadFromStorage(STORAGE_KEYS.nextId, 13));

    useEffect(() => { saveToStorage(STORAGE_KEYS.menuItems, menuItems); }, [menuItems]);
    useEffect(() => { saveToStorage(STORAGE_KEYS.orders, orders); }, [orders]);
    useEffect(() => { saveToStorage(STORAGE_KEYS.restaurantProfile, profile); }, [profile]);
    useEffect(() => { saveToStorage(STORAGE_KEYS.commissions, commissions); }, [commissions]);
    useEffect(() => { saveToStorage(STORAGE_KEYS.nextId, nextId); }, [nextId]);

    const addMenuItem = useCallback((item: Omit<MenuItem, "id">) => {
        setMenuItems((prev) => [{ ...item, id: nextId }, ...prev]);
        setNextId((id) => id + 1);
    }, [nextId]);

    const addOrder = useCallback((items: OrderItem[], channel: SalesChannel = "OFFLINE") => {
        const total = items.reduce((s, i) => s + i.price * i.qty, 0);
        const totalCost = items.reduce((s, i) => s + i.cost * i.qty, 0);
        const order: Order = {
            id: `ORD-${1000 + orders.length}`,
            items, total, totalCost,
            margin: total > 0 ? ((total - totalCost) / total) * 100 : 0,
            timestamp: new Date(),
            channel,
        };
        setOrders((prev) => [order, ...prev]);
        return order;
    }, [orders.length]);

    const importMenuItems = useCallback((items: Omit<MenuItem, "id">[]) => {
        let added = 0; let duplicates = 0; let currentId = nextId;
        setMenuItems((prev) => {
            const existing = new Set(prev.map((m) => m.name.toLowerCase()));
            const newItems: MenuItem[] = [];
            for (const item of items) {
                if (existing.has(item.name.toLowerCase())) { duplicates++; continue; }
                existing.add(item.name.toLowerCase());
                newItems.push({ ...item, id: currentId++ });
                added++;
            }
            return [...newItems, ...prev];
        });
        setNextId(currentId);
        return { added, duplicates };
    }, [nextId]);

    const importOrders = useCallback((newOrders: Order[]) => {
        setOrders((prev) => [...newOrders, ...prev]);
        return newOrders.length;
    }, []);

    const updateProfile = useCallback((updates: Partial<RestaurantProfile>) => {
        setProfile((prev) => ({ ...prev, ...updates }));
    }, []);

    const updateCommission = useCallback((channel: SalesChannel, updates: Partial<ChannelCommission>) => {
        setCommissions((prev) => prev.map((c) => c.channel === channel ? { ...c, ...updates } : c));
    }, []);

    const getCommission = useCallback((channel: SalesChannel) => {
        const c = commissions.find((cc) => cc.channel === channel);
        return c ? c.commissionPct : 0;
    }, [commissions]);

    const resetData = useCallback(() => {
        setMenuItems(seedMenuItems);
        setOrders(generateSeedOrders(seedMenuItems));
        setNextId(13);
        setProfile(defaultProfile);
        setCommissions(defaultCommissions);
    }, []);

    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return (
        <RestaurantDataContext.Provider
            value={{
                menuItems, orders, profile, commissions,
                addMenuItem, addOrder, importMenuItems, importOrders,
                updateProfile, updateCommission, getCommission, resetData,
                totalRevenue, totalOrders, avgOrderValue,
            }}
        >
            {children}
        </RestaurantDataContext.Provider>
    );
}

export function useRestaurantData() {
    const ctx = useContext(RestaurantDataContext);
    if (!ctx) throw new Error("useRestaurantData must be used inside RestaurantDataProvider");
    return ctx;
}
