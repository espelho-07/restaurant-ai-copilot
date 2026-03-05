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

    const STORAGE_KEY = "demo_restaurant_id";

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            // 1. Try to get cached restaurant ID from localStorage
            const cachedId = localStorage.getItem(STORAGE_KEY);
            let restData: any = null;

            if (cachedId) {
                const { data } = await supabase.from('restaurants').select('*').eq('id', cachedId).maybeSingle();
                restData = data;
            }

            // 2. Fall back to first available restaurant in DB
            if (!restData) {
                const { data: anyRest } = await supabase.from('restaurants').select('*').limit(1).maybeSingle();
                restData = anyRest;
                if (restData) localStorage.setItem(STORAGE_KEY, restData.id);
            }

            // 3. Auto-create a new restaurant if DB is empty
            if (!restData) {
                console.log("Demo mode: creating default restaurant...");
                const { data: newRest, error: createErr } = await supabase
                    .from('restaurants')
                    .insert({ name: 'My Restaurant', location: 'Set your location' })
                    .select()
                    .single();

                if (createErr) {
                    console.error("Failed to create restaurant:", createErr);
                    setIsLoading(false);
                    return;
                }
                restData = newRest;
                localStorage.setItem(STORAGE_KEY, newRest.id);

                // Create default channels
                await supabase.from('channels').insert([
                    { restaurant_id: newRest.id, name: 'OFFLINE', commission_percentage: 0 },
                    { restaurant_id: newRest.id, name: 'ZOMATO', commission_percentage: 25 },
                    { restaurant_id: newRest.id, name: 'SWIGGY', commission_percentage: 22 },
                    { restaurant_id: newRest.id, name: 'OTHER', commission_percentage: 15 },
                ]);
            }

            if (!restData) {
                setIsLoading(false);
                return;
            }

            setRestaurantId(restData.id);
            setProfile({
                name: restData.name || "Demo Restaurant",
                location: restData.location || "Demo City",
                cuisine: restData.cuisine || "",
                usesPOS: restData.setupComplete || false,
                setupComplete: true
            });

            // 3. Fetch parallel data
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
                    id: m.id,
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
                const grouped = new Map<string, OrderItem[]>();
                const orderMeta = new Map<string, { channel: SalesChannel, timestamp: Date }>();

                ordersData.forEach((row: any) => {
                    if (!grouped.has(row.order_id)) grouped.set(row.order_id, []);
                    grouped.get(row.order_id)!.push({
                        menuItemId: row.item_name,
                        name: row.item_name,
                        qty: row.quantity,
                        price: 0,
                        cost: 0
                    });
                    if (!orderMeta.has(row.order_id)) {
                        orderMeta.set(row.order_id, { channel: row.channel as SalesChannel, timestamp: new Date(row.timestamp) });
                    }
                });

                const mappedOrders: Order[] = Array.from(grouped.entries()).map(([orderId, items]) => {
                    const meta = orderMeta.get(orderId)!;
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
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addMenuItem = async (item: Omit<MenuItem, "id">) => {
        if (!restaurantId) return;

        // Optimistic UI update (JS CRUD)
        const tempId = Date.now();
        setMenuItems(prev => [{ ...item, id: tempId }, ...prev]);

        try {
            const { data, error } = await supabase.from('menu_items').insert({
                restaurant_id: restaurantId,
                item_name: item.name,
                category: item.category,
                selling_price: item.price,
                food_cost: item.cost
            }).select().single();

            if (!error && data) {
                setMenuItems(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id as unknown as number } : m));
            }
        } catch (e) {
            console.warn("Supabase insert failed, keeping local state for demo", e);
        }
    };

    const addOrder = async (items: OrderItem[], channel: SalesChannel = "OFFLINE") => {
        if (!restaurantId) return null;

        const orderId = `ORD-${Date.now()}`;
        const total = items.reduce((s, i) => s + i.price * i.qty, 0);
        const totalCost = items.reduce((s, i) => s + i.cost * i.qty, 0);
        const margin = total > 0 ? ((total - totalCost) / total) * 100 : 0;

        const newOrder: Order = { id: orderId, items, total, totalCost, margin, timestamp: new Date(), channel };

        // Optimistic update (JS CRUD)
        setOrders(prev => [newOrder, ...prev]);

        try {
            const rows = items.map(i => ({
                restaurant_id: restaurantId,
                order_id: orderId,
                item_name: i.name,
                quantity: i.qty,
                channel,
                timestamp: new Date().toISOString()
            }));
            await supabase.from('orders').insert(rows);
            // Non-blocking fetch in background
            fetchData();
        } catch (e) {
            console.warn("Supabase insert failed, keeping local state for demo", e);
        }
        return newOrder;
    };

    const importMenuItems = async (items: Omit<MenuItem, "id">[]) => {
        if (!restaurantId) return { added: 0, duplicates: 0 };

        // Optimistic update (JS CRUD)
        const newItems = items.map((item, i) => ({ ...item, id: Date.now() + i }));
        setMenuItems(prev => [...newItems, ...prev]);

        try {
            const rows = items.map(i => ({
                restaurant_id: restaurantId,
                item_name: i.name,
                category: i.category,
                selling_price: i.price,
                food_cost: i.cost
            }));
            await supabase.from('menu_items').insert(rows);
            // Non-blocking fetch in background
            fetchData();
            return { added: items.length, duplicates: 0 };
        } catch (e) {
            console.warn("Supabase import failed, keeping local state for demo", e);
            return { added: items.length, duplicates: 0 };
        }
    };

    const importOrders = async (newOrders: Order[]) => {
        if (!restaurantId) return 0;

        // Optimistic update (JS CRUD)
        setOrders(prev => [...newOrders, ...prev]);

        try {
            const flat: any[] = [];
            newOrders.forEach(o => {
                o.items.forEach(i => {
                    flat.push({
                        restaurant_id: restaurantId,
                        order_id: o.id,
                        item_name: i.name,
                        quantity: i.qty,
                        channel: o.channel,
                        timestamp: o.timestamp.toISOString()
                    });
                });
            });
            await supabase.from('orders').insert(flat);
            // Non-blocking fetch in background
            fetchData();
            return newOrders.length;
        } catch (e) {
            console.warn("Supabase import failed, keeping local state for demo", e);
            return newOrders.length;
        }
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
        if (!restaurantId) return;
        setCommissions(prev => prev.map(c => c.channel === channel ? { ...c, ...updates } : c));

        const target = commissions.find(c => c.channel === channel);
        if (target) {
            await supabase.from('channels').upsert({
                restaurant_id: restaurantId,
                name: target.channel,
                commission_percentage: updates.commissionPct ?? target.commissionPct
            }, { onConflict: 'restaurant_id,name' });
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
