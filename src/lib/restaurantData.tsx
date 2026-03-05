import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { MenuItem, Order, OrderItem, SalesChannel, ChannelCommission } from "./types";
import { toast } from "sonner";

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

const defaultCommissions: ChannelCommission[] = [
    { channel: "OFFLINE", label: "Offline / Dine-in", commissionPct: 0, enabled: true },
    { channel: "ZOMATO", label: "Zomato", commissionPct: 25, enabled: true },
    { channel: "SWIGGY", label: "Swiggy", commissionPct: 22, enabled: true },
    { channel: "OTHER", label: "Other Online", commissionPct: 15, enabled: false },
];

interface RestaurantDataContextType {
    menuItems: MenuItem[];
    orders: Order[];
    profile: RestaurantProfile;
    commissions: ChannelCommission[];
    isLoading: boolean;
    addMenuItem: (item: Omit<MenuItem, "id">) => Promise<void>;
    removeMenuItem: (id: number) => Promise<void>;
    addOrder: (items: OrderItem[], channel?: SalesChannel) => Promise<Order | null>;
    importMenuItems: (items: Omit<MenuItem, "id">[]) => Promise<{ added: number; duplicates: number }>;
    importOrders: (newOrders: Order[]) => Promise<number>;
    updateProfile: (updates: Partial<RestaurantProfile>) => Promise<void>;
    updateCommission: (channel: SalesChannel, updates: Partial<ChannelCommission>) => Promise<void>;
    getCommission: (channel: SalesChannel) => number;
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
}

const RestaurantDataContext = createContext<RestaurantDataContextType | null>(null);

const STORAGE_KEYS = {
    PROFILE: "app_profile",
    MENU: "app_menu",
    ORDERS: "app_orders",
    COMMISSIONS: "app_commissions"
};

export function RestaurantDataProvider({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);

    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [profile, setProfile] = useState<RestaurantProfile>(defaultProfile);
    const [commissions, setCommissions] = useState<ChannelCommission[]>(defaultCommissions);

    // Initial Data Load
    useEffect(() => {
        try {
            const p = localStorage.getItem(STORAGE_KEYS.PROFILE);
            if (p) setProfile(JSON.parse(p));

            const m = localStorage.getItem(STORAGE_KEYS.MENU);
            if (m) setMenuItems(JSON.parse(m));

            const o = localStorage.getItem(STORAGE_KEYS.ORDERS);
            if (o) {
                const parsedOrders = JSON.parse(o).map((order: any) => ({
                    ...order,
                    timestamp: new Date(order.timestamp)
                }));
                setOrders(parsedOrders);
            }

            const c = localStorage.getItem(STORAGE_KEYS.COMMISSIONS);
            if (c) setCommissions(JSON.parse(c));
        } catch (e) {
            console.error("Local storage parse error:", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // State Sync Effects
    useEffect(() => {
        if (!isLoading) localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    }, [profile, isLoading]);

    useEffect(() => {
        if (!isLoading) localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menuItems));
    }, [menuItems, isLoading]);

    useEffect(() => {
        if (!isLoading) localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    }, [orders, isLoading]);

    useEffect(() => {
        if (!isLoading) localStorage.setItem(STORAGE_KEYS.COMMISSIONS, JSON.stringify(commissions));
    }, [commissions, isLoading]);

    const addMenuItem = async (item: Omit<MenuItem, "id">) => {
        const newItem = { ...item, id: Date.now() };
        setMenuItems(prev => [newItem, ...prev]);
    };

    const removeMenuItem = async (id: number) => {
        setMenuItems(prev => prev.filter(item => item.id !== id));
    };

    const addOrder = async (items: OrderItem[], channel: SalesChannel = "OFFLINE") => {
        const orderId = `ORD-${Date.now()}`;
        const total = items.reduce((s, i) => s + i.price * i.qty, 0);
        const totalCost = items.reduce((s, i) => s + i.cost * i.qty, 0);
        const margin = total > 0 ? ((total - totalCost) / total) * 100 : 0;

        const newOrder: Order = { id: orderId, items, total, totalCost, margin, timestamp: new Date(), channel };
        setOrders(prev => [newOrder, ...prev]);
        return newOrder;
    };

    const importMenuItems = async (items: Omit<MenuItem, "id">[]) => {
        const newItems = items.map((item, i) => ({ ...item, id: Date.now() + i }));
        setMenuItems(prev => [...newItems, ...prev]);
        return { added: items.length, duplicates: 0 };
    };

    const importOrders = async (newOrders: Order[]) => {
        setOrders(prev => [...newOrders, ...prev]);
        return newOrders.length;
    };

    const updateProfile = async (updates: Partial<RestaurantProfile>) => {
        setProfile(prev => ({ ...prev, ...updates }));
    };

    const updateCommission = async (channel: SalesChannel, updates: Partial<ChannelCommission>) => {
        setCommissions(prev => prev.map(c => c.channel === channel ? { ...c, ...updates } : c));
    };

    const getCommission = useCallback((channel: SalesChannel) => {
        const c = commissions.find(cc => cc.channel === channel);
        return c?.enabled ? c.commissionPct : 0;
    }, [commissions]);

    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return (
        <RestaurantDataContext.Provider
            value={{
                menuItems, orders, profile, commissions, isLoading,
                addMenuItem, removeMenuItem, addOrder, importMenuItems, importOrders,
                updateProfile, updateCommission, getCommission,
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
