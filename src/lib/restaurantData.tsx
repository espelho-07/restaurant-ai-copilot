import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { MenuItem, Order, OrderItem, SalesChannel, ChannelCommission } from "./types";
import { supabase } from "./supabase";
import { useAuth } from "@/components/AuthProvider";
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

export function RestaurantDataProvider({ children }: { children: React.ReactNode }) {
    const { user, session } = useAuth();
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [profile, setProfile] = useState<RestaurantProfile>(defaultProfile);
    const [commissions, setCommissions] = useState<ChannelCommission[]>(defaultCommissions);

    const fetchData = useCallback(async () => {
        if (!user) {
            setMenuItems([]);
            setOrders([]);
            setRestaurantId(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            // 1. Get restaurant profile mapped to user
            let { data: restData } = await supabase.from('restaurants').select('*').eq('user_id', user.id).single();
            if (!restData) {
                // If trigger failed or slow, wait 1s and retry
                await new Promise(r => setTimeout(r, 1000));
                const retry = await supabase.from('restaurants').select('*').eq('user_id', user.id).single();
                restData = retry.data;
            }

            if (!restData) {
                console.error("No restaurant profile found for user.");
                setIsLoading(false);
                return;
            }

            setRestaurantId(restData.id);
            setProfile({
                name: restData.name || "",
                location: restData.location || "",
                cuisine: restData.cuisine || "",
                usesPOS: restData.setupComplete || false,
                setupComplete: true
            });

            // 2. Fetch parallel data
            const [
                { data: menuData },
                { data: ordersData },
                { data: channelsData }
            ] = await Promise.all([
                supabase.from('menu_items').select('*').eq('restaurant_id', restData.id).order('created_at', { ascending: false }),
                supabase.from('orders').select('*').eq('restaurant_id', restData.id).order('timestamp', { ascending: false }),
                supabase.from('channels').select('*').eq('restaurant_id', restData.id)
            ]);

            // Map Menu
            if (menuData) {
                const mappedMenu: MenuItem[] = menuData.map((m: any) => ({
                    id: m.id, // Usually a UUID string now, but the UI expects number, so we might have TS issues if id was strictly number. 
                    // Let's ensure types are cast correctly or just ignore the number strictness
                    name: m.item_name,
                    price: m.selling_price,
                    cost: m.food_cost,
                    category: m.category,
                    aliases: []
                }));
                setMenuItems(mappedMenu as any[]);
            }

            // Map Orders
            if (ordersData) {
                // Orders are flat in DB (order_id separates them). We must group them by order_id to match the Context structure!
                const grouped = new Map<string, OrderItem[]>();
                const orderMeta = new Map<string, { channel: SalesChannel, timestamp: Date }>();

                ordersData.forEach((row: any) => {
                    if (!grouped.has(row.order_id)) grouped.set(row.order_id, []);
                    grouped.get(row.order_id)!.push({
                        menuItemId: row.item_name, // Using name since id changed
                        name: row.item_name,
                        qty: row.quantity,
                        price: 0, // Fallback since DB structure is denormalized
                        cost: 0
                    });
                    if (!orderMeta.has(row.order_id)) {
                        orderMeta.set(row.order_id, { channel: row.channel as SalesChannel, timestamp: new Date(row.timestamp) });
                    }
                });

                const mappedOrders: Order[] = Array.from(grouped.entries()).map(([orderId, items]) => {
                    const meta = orderMeta.get(orderId)!;

                    // Attempt to reconstruct total and costs from current menuItems list since not strictly stored in orders table
                    const enrichedItems = items.map(oi => {
                        const m = menuData?.find((md: any) => md.item_name === oi.name);
                        return {
                            ...oi,
                            price: m ? m.selling_price : 0,
                            cost: m ? m.food_cost : 0
                        };
                    });
                    const total = enrichedItems.reduce((s, i) => s + (i.price * i.qty), 0);
                    const totalCost = enrichedItems.reduce((s, i) => s + (i.cost * i.qty), 0);

                    return {
                        id: orderId,
                        items: enrichedItems,
                        total,
                        totalCost,
                        margin: total > 0 ? ((total - totalCost) / total) * 100 : 0,
                        channel: meta.channel,
                        timestamp: meta.timestamp
                    };
                });
                setOrders(mappedOrders);
            }

            if (channelsData?.length) {
                const mappedCommissions = defaultCommissions.map(dc => {
                    const found = channelsData.find((cd: any) => cd.name === dc.channel);
                    if (found) {
                        return { ...dc, commissionPct: found.commission_percentage, enabled: true };
                    }
                    return dc;
                });
                setCommissions(mappedCommissions);
            }

        } catch (error) {
            console.error("Error fetching restaurant data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addMenuItem = async (item: Omit<MenuItem, "id">) => {
        if (!restaurantId) return;
        const { data, error } = await supabase.from('menu_items').insert({
            restaurant_id: restaurantId,
            item_name: item.name,
            category: item.category,
            selling_price: item.price,
            food_cost: item.cost
        }).select().single();

        if (!error && data) {
            setMenuItems(prev => [{
                ...item,
                id: data.id as unknown as number
            }, ...prev]);
        }
    };

    const addOrder = async (items: OrderItem[], channel: SalesChannel = "OFFLINE") => {
        if (!restaurantId || !session?.access_token) return null;
        try {
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ items, channel })
            });
            if (res.ok) {
                await fetchData(); // simple refresh
                const data = await res.json();
                return { id: data.order_id, items, total: 0, totalCost: 0, margin: 0, timestamp: new Date(), channel } as Order;
            }
        } catch (e) {
            console.error(e);
        }
        return null;
    };

    const importMenuItems = async (items: Omit<MenuItem, "id">[]) => {
        if (!restaurantId || !session?.access_token) return { added: 0, duplicates: 0 };
        try {
            const res = await fetch('/api/menu/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify(items.map(i => ({ name: i.name, category: i.category, price: i.price, cost: i.cost })))
            });
            if (res.ok) {
                await fetchData();
                return { added: items.length, duplicates: 0 };
            }
        } catch (e) { }
        return { added: 0, duplicates: 0 };
    };

    const importOrders = async (newOrders: Order[]) => {
        if (!restaurantId || !session?.access_token) return 0;
        try {
            // Flatten orders
            const flat: any[] = [];
            newOrders.forEach(o => {
                o.items.forEach(i => {
                    flat.push({
                        order_id: o.id,
                        name: i.name,
                        qty: i.qty,
                        channel: o.channel,
                        timestamp: o.timestamp.toISOString()
                    });
                });
            });
            const res = await fetch('/api/orders/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify(flat)
            });
            if (res.ok) {
                await fetchData();
                return newOrders.length;
            }
        } catch (e) { }
        return 0;
    };

    const updateProfile = async (updates: Partial<RestaurantProfile>) => {
        if (!restaurantId) return;
        setProfile(prev => ({ ...prev, ...updates }));
        if (updates.name || updates.location || updates.cuisine) {
            await supabase.from('restaurants').update({
                name: updates.name,
                location: updates.location,
                cuisine: updates.cuisine,
            }).eq('id', restaurantId);
        }
    };

    const updateCommission = async (channel: SalesChannel, updates: Partial<ChannelCommission>) => {
        if (!restaurantId || !session?.access_token) return;
        setCommissions(prev => prev.map(c => c.channel === channel ? { ...c, ...updates } : c));

        // Find fully updated commission object to send to backend
        const target = commissions.find(c => c.channel === channel);
        if (target) {
            await fetch('/api/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ name: target.channel, commission_percentage: updates.commissionPct ?? target.commissionPct })
            });
        }
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
                addMenuItem, addOrder, importMenuItems, importOrders,
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
