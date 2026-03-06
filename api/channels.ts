import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "./_lib/auth.js";

const defaultChannels = [
  { name: "OFFLINE", commission_percentage: 0, enabled: true },
  { name: "ZOMATO", commission_percentage: 25, enabled: true },
  { name: "SWIGGY", commission_percentage: 25, enabled: true },
  { name: "CALL", commission_percentage: 0, enabled: true },
  { name: "OTHER", commission_percentage: 15, enabled: false },
];

function normalizeChannelName(name: string): string {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();

  if (["OFFLINE", "DINEIN", "DINE_IN"].includes(upper)) return "OFFLINE";
  if (["ZOMATO"].includes(upper)) return "ZOMATO";
  if (["SWIGGY"].includes(upper)) return "SWIGGY";
  if (["CALL", "PHONE"].includes(upper)) return "CALL";
  if (["OTHER"].includes(upper)) return "OTHER";

  return raw;
}

function hasSchemaMismatch(errorMessage: string): boolean {
  const msg = String(errorMessage || "").toLowerCase();
  return (
    msg.includes("could not find the 'restaurant_id' column") ||
    msg.includes("column \"restaurant_id\" does not exist") ||
    msg.includes("relation \"channels\" does not exist")
  );
}

async function ensureDefaultChannels(restaurantId: string) {
  await supabase
    .from("channels")
    .upsert(
      defaultChannels.map((channel) => ({
        restaurant_id: restaurantId,
        ...channel,
      })),
      { onConflict: "restaurant_id,name" },
    );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { restaurantId } = await getAuthContext(req);

    if (req.method === "GET") {
      const { data: rows, error } = await supabase
        .from("channels")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name", { ascending: true });

      if (error) {
        if (hasSchemaMismatch(error.message)) {
          return res.status(200).json(defaultChannels);
        }
        return res.status(500).json({ error: error.message });
      }

      if (!rows || rows.length === 0) {
        try {
          await ensureDefaultChannels(restaurantId);

          const { data: seededRows, error: seededError } = await supabase
            .from("channels")
            .select("*")
            .eq("restaurant_id", restaurantId)
            .order("name", { ascending: true });

          if (seededError) {
            if (hasSchemaMismatch(seededError.message)) {
              return res.status(200).json(defaultChannels);
            }
            return res.status(500).json({ error: seededError.message });
          }

          return res.status(200).json(seededRows || defaultChannels);
        } catch {
          return res.status(200).json(defaultChannels);
        }
      }

      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const name = normalizeChannelName(String(req.body?.name || req.body?.channel || ""));
      const commissionPercentage = parseNumber(req.body?.commission_percentage ?? req.body?.commissionPct, 0);
      const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : true;

      if (!name) return res.status(400).json({ error: "Channel name is required" });

      const baseRow = {
        restaurant_id: restaurantId,
        name,
        commission_percentage: commissionPercentage,
      };

      let data: any = null;
      let writeError: any = null;

      const withEnabled = await supabase
        .from("channels")
        .upsert({
          ...baseRow,
          enabled,
        }, { onConflict: "restaurant_id,name" })
        .select("*")
        .single();

      data = withEnabled.data;
      writeError = withEnabled.error;

      if (writeError && /column .*enabled/i.test(writeError.message || "")) {
        const fallback = await supabase
          .from("channels")
          .upsert(baseRow, { onConflict: "restaurant_id,name" })
          .select("*")
          .single();

        data = fallback.data;
        writeError = fallback.error;
      }

      if (writeError) {
        if (hasSchemaMismatch(writeError.message)) {
          return res.status(200).json({
            name,
            commission_percentage: commissionPercentage,
            enabled,
            skipped: true,
          });
        }

        return res.status(500).json({ error: writeError.message });
      }

      return res.status(200).json(data);
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || req.body?.id;
      const rawName = req.query?.name || req.body?.name || req.body?.channel;
      const name = rawName ? normalizeChannelName(String(rawName)) : "";

      let query = supabase.from("channels").delete().eq("restaurant_id", restaurantId);
      if (id) {
        query = query.eq("id", id);
      } else if (name) {
        query = query.eq("name", name);
      } else {
        return res.status(400).json({ error: "Provide channel id or name" });
      }

      const { error } = await query;
      if (error) {
        if (hasSchemaMismatch(error.message)) {
          return res.status(200).json({ success: true, skipped: true });
        }
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
