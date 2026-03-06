import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MenuItem, Order, OrderItem, SalesChannel, ChannelCommission } from "./types";
import type { POSConfig } from "./posService";
import { defaultPOSConfig } from "./posService";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";

export interface RestaurantProfile {
    name: string;
    location: string;
    cuisine: string;
    usesPOS: boolean;
    setupComplete: boolean;
    posConfig?: POSConfig;
}

const defaultProfile: RestaurantProfile = {
    name: "",
    location: "",
    cuisine: "",
    usesPOS: false,
    setupComplete: false,
    posConfig: defaultPOSConfig,
};

const defaultCommissions: ChannelCommission[] = [
    { channel: "OFFLINE", label: "Offline / Dine-in", commissionPct: 0, enabled: true },
    { channel: "ZOMATO", label: "Zomato", commissionPct: 25, enabled: true },
    { channel: "SWIGGY", label: "Swiggy", commissionPct: 25, enabled: true },
    { channel: "CALL", label: "Phone Orders", commissionPct: 0, enabled: true },
    { channel: "OTHER", label: "Other Online", commissionPct: 15, enabled: false },
];

const channelNameMap: Record<string, SalesChannel> = {
    OFFLINE: "OFFLINE",
    DINEIN: "OFFLINE",
    DINE_IN: "OFFLINE",
    ZOMATO: "ZOMATO",
    SWIGGY: "SWIGGY",
    CALL: "CALL",
    PHONE: "CALL",
    OTHER: "OTHER",
};

const channelLabelMap: Record<SalesChannel, string> = {
    OFFLINE: "Offline / Dine-in",
    ZOMATO: "Zomato",
    SWIGGY: "Swiggy",
    CALL: "Phone Orders",
    OTHER: "Other Online",
};

const builtInLabelMap: Record<string, SalesChannel> = {
    "offline / dine-in": "OFFLINE",
    "zomato": "ZOMATO",
    "swiggy": "SWIGGY",
    "phone orders": "CALL",
    "other online": "OTHER",
};

interface RestaurantDataContextType {
    menuItems: MenuItem[];
    orders: Order[];
    profile: RestaurantProfile;
    commissions: ChannelCommission[];
    isLoading: boolean;
    addMenuItem: (item: Omit<MenuItem, "id">) => Promise<void>;
    removeMenuItem: (id: number) => Promise<void>;
    updateMenuItem: (id: number, updates: Partial<Omit<MenuItem, "id">>) => Promise<void>;
    addOrder: (items: OrderItem[], channel?: SalesChannel) => Promise<Order | null>;
    importMenuItems: (items: Omit<MenuItem, "id">[]) => Promise<{ added: number; duplicates: number }>;
    importOrders: (newOrders: Order[]) => Promise<number>;
    updateProfile: (updates: Partial<RestaurantProfile>) => Promise<void>;
    updatePOSConfig: (config: POSConfig) => Promise<void>;
    updateCommission: (channel: SalesChannel, updates: Partial<ChannelCommission>) => Promise<void>;
    addCommission: (label: string, commissionPct: number) => Promise<void>;
    removeCommission: (label: string) => Promise<void>;
    getCommission: (channel: SalesChannel) => number;
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
}

const RestaurantDataContext = createContext<RestaurantDataContextType | null>(null);

function toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeChannel(value: unknown): SalesChannel {
    const raw = String(value || "OFFLINE").trim().toUpperCase();
    return channelNameMap[raw] || "OTHER";
}

function mapMenuItem(row: any): MenuItem {
    return {
        id: toNumber(row?.id, Date.now()),
        name: String(row?.name || row?.item_name || "").trim(),
        category: String(row?.category || "General").trim() || "General",
        price: toNumber(row?.price ?? row?.selling_price, 0),
        cost: toNumber(row?.cost ?? row?.food_cost, 0),
        aliases: Array.isArray(row?.aliases) ? row.aliases : undefined,
    };
}

function mapOrder(order: any): Order {
    const items = Array.isArray(order?.items)
        ? order.items.map((item: any) => ({
            menuItemId: toNumber(item?.menuItemId ?? item?.menu_item_id ?? item?.menu_itemid, 0),
            name: String(item?.name || item?.item_name || "").trim(),
            qty: Math.max(1, toNumber(item?.qty ?? item?.quantity, 1)),
            price: toNumber(item?.price ?? item?.selling_price, 0),
            cost: toNumber(item?.cost ?? item?.food_cost, 0),
        }))
        : [];

    const total = toNumber(order?.total, items.reduce((sum, item) => sum + item.price * item.qty, 0));
    const totalCost = toNumber(order?.totalCost ?? order?.total_cost, items.reduce((sum, item) => sum + item.cost * item.qty, 0));
    const margin = total > 0 ? ((total - totalCost) / total) * 100 : 0;

    return {
        id: String(order?.id || order?.orderId || order?.order_id || `ORD-${Date.now()}`),
        items,
        total,
        totalCost,
        margin: toNumber(order?.margin, margin),
        timestamp: new Date(order?.timestamp || order?.created_at || new Date().toISOString()),
        channel: normalizeChannel(order?.channel),
    };
}

function mapProfile(row: any): RestaurantProfile {
    const rawPos = row?.posConfig || row?.pos_config || {};
    const posConfig: POSConfig = {
        ...defaultPOSConfig,
        posType: rawPos?.posType || rawPos?.pos_type || "none",
        apiBaseUrl: rawPos?.apiBaseUrl || rawPos?.api_base_url || "",
        apiKey: rawPos?.apiKey || rawPos?.api_key || "",
        restaurantId: rawPos?.restaurantId || rawPos?.restaurant_id || "",
        secretKey: rawPos?.secretKey || rawPos?.secret_key || "",
        autoSync: Boolean(rawPos?.autoSync ?? rawPos?.auto_sync),
        syncIntervalMinutes: toNumber(rawPos?.syncIntervalMinutes ?? rawPos?.sync_interval_minutes, 5),
        connected: Boolean(rawPos?.connected ?? rawPos?.posType ?? rawPos?.pos_type),
    };

    return {
        name: String(row?.name || ""),
        location: String(row?.location || ""),
        cuisine: String(row?.cuisine || ""),
        usesPOS: Boolean(row?.usesPOS ?? row?.uses_pos),
        setupComplete: Boolean(row?.setupComplete ?? row?.setup_complete),
        posConfig,
    };
}

function mapCommissions(rows: any[]): ChannelCommission[] {
    const merged = new Map<string, ChannelCommission>();

    for (const base of defaultCommissions) {
        merged.set(base.label.toLowerCase(), { ...base });
    }

    for (const row of rows || []) {
        const rawName = String(row?.name || row?.channel || row?.label || "").trim();
        if (!rawName) continue;

        const normalized = normalizeChannel(rawName);
        const isBuiltIn = Object.prototype.hasOwnProperty.call(channelNameMap, rawName.toUpperCase());
        const label = isBuiltIn ? channelLabelMap[normalized] : String(row?.label || rawName);

        merged.set(label.toLowerCase(), {
            channel: isBuiltIn ? normalized : "OTHER",
            label,
            commissionPct: toNumber(row?.commission_percentage ?? row?.commissionPct, 0),
            enabled: typeof row?.enabled === "boolean" ? row.enabled : true,
        });
    }

    return Array.from(merged.values());
}

export function RestaurantDataProvider({ children }: { children: React.ReactNode }) {
    const { user, session } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [profile, setProfile] = useState<RestaurantProfile>(defaultProfile);
    const [commissions, setCommissions] = useState<ChannelCommission[]>(defaultCommissions);

    const requestJson = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
        if (!session?.access_token) {
            throw new Error("Authentication required");
        }

        const headers = new Headers(init.headers || {});
        headers.set("Authorization", `Bearer ${session.access_token}`);

        if (init.body && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(path, { ...init, headers });

        let payload: any = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }

        if (!response.ok) {
            throw new Error(payload?.error || `Request failed (${response.status})`);
        }

        return payload as T;
    }, [session?.access_token]);

    const refreshMenu = useCallback(async () => {
        const data = await requestJson<any[]>("/api/menu");
        setMenuItems((Array.isArray(data) ? data : []).map(mapMenuItem));
    }, [requestJson]);

    const refreshOrders = useCallback(async () => {
        const data = await requestJson<any[]>("/api/orders");
        setOrders((Array.isArray(data) ? data : []).map(mapOrder));
    }, [requestJson]);

    const refreshProfile = useCallback(async () => {
        const data = await requestJson<any>("/api/restaurants/profile");
        setProfile(mapProfile(data));
    }, [requestJson]);

    const refreshChannels = useCallback(async () => {
        const data = await requestJson<any[]>("/api/channels");
        setCommissions(mapCommissions(Array.isArray(data) ? data : []));
    }, [requestJson]);

    const loadAll = useCallback(async () => {
        if (!user || !session?.access_token) {
            setMenuItems([]);
            setOrders([]);
            setProfile(defaultProfile);
            setCommissions(defaultCommissions);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const results = await Promise.allSettled([
                refreshProfile(),
                refreshMenu(),
                refreshOrders(),
                refreshChannels(),
            ]);

            const failures = results
                .filter((result): result is PromiseRejectedResult => result.status === "rejected")
                .map((result) => result.reason);

            if (failures.length > 0) {
                const first = failures[0];
                console.error("Some restaurant data requests failed", failures);
                toast.error("Some data failed to refresh", {
                    description: first instanceof Error ? first.message : "Unexpected error",
                });
            }
        } catch (error) {
            console.error("Failed to load restaurant data", error);
            toast.error("Failed to load restaurant data", {
                description: error instanceof Error ? error.message : "Unexpected error",
            });
        } finally {
            setIsLoading(false);
        }
    }, [refreshChannels, refreshMenu, refreshOrders, refreshProfile, session?.access_token, user]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const addMenuItem = async (item: Omit<MenuItem, "id">) => {
        await requestJson<any[]>("/api/menu", {
            method: "POST",
            body: JSON.stringify([item]),
        });
        await refreshMenu();
    };

    const removeMenuItem = async (id: number) => {
        await requestJson<{ success: boolean }>(`/api/menu?id=${id}`, { method: "DELETE" });
        setMenuItems((prev) => prev.filter((item) => item.id !== id));
    };

    const updateMenuItem = async (id: number, updates: Partial<Omit<MenuItem, "id">>) => {
        const updated = await requestJson<any>("/api/menu", {
            method: "PUT",
            body: JSON.stringify({ id, ...updates }),
        });

        const mapped = mapMenuItem(updated);
        setMenuItems((prev) => prev.map((item) => (item.id === id ? mapped : item)));
    };

    const addOrder = async (items: OrderItem[], channel: SalesChannel = "OFFLINE") => {
        if (!Array.isArray(items) || items.length === 0) return null;

        const created = await requestJson<{ orderId: string }>("/api/orders", {
            method: "POST",
            body: JSON.stringify({ items, channel }),
        });

        const refreshed = await requestJson<any[]>("/api/orders");
        const mappedOrders = (Array.isArray(refreshed) ? refreshed : []).map(mapOrder);
        setOrders(mappedOrders);

        return mappedOrders.find((order) => order.id === created.orderId) || null;
    };

    const importMenuItems = async (items: Omit<MenuItem, "id">[]) => {
        if (!Array.isArray(items) || items.length === 0) {
            return { added: 0, duplicates: 0 };
        }

        const inserted = await requestJson<any[]>("/api/menu", {
            method: "POST",
            body: JSON.stringify(items),
        });

        await refreshMenu();
        const added = Array.isArray(inserted) ? inserted.length : items.length;
        return { added, duplicates: Math.max(0, items.length - added) };
    };

    const importOrders = async (newOrders: Order[]) => {
        if (!Array.isArray(newOrders) || newOrders.length === 0) return 0;

        const rows = newOrders.flatMap((order) =>
            order.items.map((item) => ({
                order_id: order.id,
                item_name: item.name,
                quantity: item.qty,
                channel: order.channel,
                timestamp: new Date(order.timestamp).toISOString(),
            })),
        );

        const result = await requestJson<{ count?: number }>("/api/orders/upload", {
            method: "POST",
            body: JSON.stringify(rows),
        });

        await refreshOrders();
        return toNumber(result?.count, rows.length);
    };

    const updateProfile = async (updates: Partial<RestaurantProfile>) => {
        const merged = {
            ...profile,
            ...updates,
            posConfig: updates.posConfig || profile.posConfig || defaultPOSConfig,
        };

        const updated = await requestJson<any>("/api/restaurants/profile", {
            method: "PUT",
            body: JSON.stringify(merged),
        });

        setProfile(mapProfile(updated));
    };

    const updatePOSConfig = async (config: POSConfig) => {
        await updateProfile({ posConfig: config, usesPOS: config.posType !== "none" });
    };

    const updateCommission = async (channel: SalesChannel, updates: Partial<ChannelCommission>) => {
        const exact = updates.label
            ? commissions.find((commission) => commission.label === updates.label)
            : commissions.find((commission) => commission.channel === channel);

        const requestedLabel = updates.label || exact?.label || "";
        const mappedByLabel = builtInLabelMap[requestedLabel.toLowerCase()];
        const name = channel !== "OTHER"
            ? channel
            : mappedByLabel
                ? mappedByLabel
                : requestedLabel || "OTHER";
        const commissionPct = typeof updates.commissionPct === "number"
            ? updates.commissionPct
            : exact?.commissionPct || 0;
        const enabled = typeof updates.enabled === "boolean"
            ? updates.enabled
            : exact?.enabled ?? true;

        await requestJson<any>("/api/channels", {
            method: "POST",
            body: JSON.stringify({
                name,
                commission_percentage: commissionPct,
                enabled,
            }),
        });

        await refreshChannels();
    };

    const addCommission = async (label: string, commissionPct: number) => {
        await requestJson<any>("/api/channels", {
            method: "POST",
            body: JSON.stringify({
                name: label,
                commission_percentage: commissionPct,
                enabled: true,
            }),
        });

        await refreshChannels();
    };

    const removeCommission = async (label: string) => {
        await requestJson<any>("/api/channels", {
            method: "DELETE",
            body: JSON.stringify({ name: label }),
        });

        await refreshChannels();
    };

    const getCommission = useCallback((channel: SalesChannel) => {
        const commission = commissions.find((entry) => entry.channel === channel);
        return commission?.enabled ? commission.commissionPct : 0;
    }, [commissions]);

    const totals = useMemo(() => {
        const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        return { totalRevenue, totalOrders, avgOrderValue };
    }, [orders]);

    return (
        <RestaurantDataContext.Provider
            value={{
                menuItems,
                orders,
                profile,
                commissions,
                isLoading,
                addMenuItem,
                removeMenuItem,
                updateMenuItem,
                addOrder,
                importMenuItems,
                importOrders,
                updateProfile,
                updatePOSConfig,
                updateCommission,
                addCommission,
                removeCommission,
                getCommission,
                totalRevenue: totals.totalRevenue,
                totalOrders: totals.totalOrders,
                avgOrderValue: totals.avgOrderValue,
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

