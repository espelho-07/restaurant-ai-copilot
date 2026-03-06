// Telephony Service
// Utility helpers for call-agent dashboard widgets.

import { supabase } from "./supabase";

export function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface RecentCall {
    callSid: string;
    status: string;
    orderId: string | null;
    total: number;
    timestamp: string;
    transcript: { role: string; text: string }[];
}

export async function fetchRecentCalls(): Promise<RecentCall[]> {
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return [];

        const res = await fetch("/api/calls/recent", {
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
        });

        if (!res.ok) return [];

        const payload = await res.json();
        return Array.isArray(payload?.calls) ? payload.calls : [];
    } catch {
        return [];
    }
}

export function computeAnalytics(calls: RecentCall[]) {
    const successful = calls.filter((call) => call.status === "completed" && call.orderId);
    const transferred = calls.filter((call) => call.status === "transferred");

    return {
        totalCalls: calls.length,
        successfulOrders: successful.length,
        transferredCalls: transferred.length,
        successRate: calls.length > 0 ? Math.round((successful.length / calls.length) * 100) : 0,
        totalRevenue: successful.reduce((sum, call) => sum + (call.total || 0), 0),
        avgOrderValue: successful.length > 0
            ? Math.round(successful.reduce((sum, call) => sum + (call.total || 0), 0) / successful.length)
            : 0,
    };
}