// CSV & Excel parser utility for importing restaurant data.
// Uses PapaParse for CSV and SheetJS (xlsx) for Excel.

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { MenuItem, Order, OrderItem } from "./types.js";

function normalizeHeader(value: string): string {
    return value.toLowerCase().replace(/[_\s-]/g, "").trim();
}

function normalizeText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function parseLooseNumber(value: string): number {
    if (!value) return NaN;
    const cleaned = value.replace(/[^0-9.-]/g, "");
    return Number(cleaned);
}

function getField(row: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
        const direct = row[key];
        if (direct !== undefined && direct !== null && String(direct).trim() !== "") return String(direct).trim();
    }

    const rowKeys = Object.keys(row);
    for (const key of keys) {
        const normalized = normalizeHeader(key);
        const foundKey = rowKeys.find((k) => normalizeHeader(k) === normalized);
        if (!foundKey) continue;

        const value = row[foundKey];
        if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
    }

    return "";
}

async function readSpreadsheet(file: File): Promise<{ sheetName: string; data: Record<string, unknown>[] }[]> {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header: string) => header.trim(),
                complete: (results) => resolve([{ sheetName: "CSV", data: (results.data || []) as Record<string, unknown>[] }]),
                error: (error) => reject(error),
            });
        });
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });

                const sheets = workbook.SheetNames.map((sheetName) => {
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

                    const trimmedRows = rows.map((row) => {
                        const out: Record<string, unknown> = {};
                        for (const key of Object.keys(row)) out[key.trim()] = row[key];
                        return out;
                    });

                    return { sheetName, data: trimmedRows };
                });

                resolve(sheets);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}

function pickSheet(
    sheets: { sheetName: string; data: Record<string, unknown>[] }[],
    headerCandidates: string[],
): Record<string, unknown>[] {
    for (const sheet of sheets) {
        if (!sheet.data.length) continue;
        const headers = Object.keys(sheet.data[0]).map(normalizeHeader);
        if (headerCandidates.some((candidate) => headers.includes(normalizeHeader(candidate)))) {
            return sheet.data;
        }
    }

    return sheets.find((sheet) => sheet.data.length > 0)?.data || [];
}

function findMenuItemByName(menuItems: MenuItem[], rawName: string): MenuItem | undefined {
    const needle = normalizeText(rawName);
    if (!needle) return undefined;

    for (const item of menuItems) {
        if (normalizeText(item.name) === needle) return item;
        if (item.aliases?.some((alias) => normalizeText(alias) === needle)) return item;
    }

    for (const item of menuItems) {
        const itemNorm = normalizeText(item.name);
        if (itemNorm.includes(needle) || needle.includes(itemNorm)) return item;

        if (item.aliases?.some((alias) => {
            const aliasNorm = normalizeText(alias);
            return aliasNorm.includes(needle) || needle.includes(aliasNorm);
        })) {
            return item;
        }
    }

    return undefined;
}

export async function parseMenuCSV(file: File): Promise<{ items: Omit<MenuItem, "id">[]; errors: string[] }> {
    try {
        const sheets = await readSpreadsheet(file);
        const targetData = pickSheet(sheets, ["selling price", "price", "food cost", "cost", "item name"]);

        const items: Omit<MenuItem, "id">[] = [];
        const errors: string[] = [];

        for (let i = 0; i < targetData.length; i++) {
            const row = targetData[i];
            const rowNum = i + 2;

            const name = getField(row, "Item Name", "item_name", "Name", "name");
            const priceStr = getField(row, "Selling Price", "selling_price", "Price", "price");
            const costStr = getField(row, "Food Cost", "food_cost", "Cost", "cost");
            const category = getField(row, "Category", "category") || "Other";

            if (!name) {
                if (priceStr || costStr) errors.push(`Row ${rowNum}: Missing item name`);
                continue;
            }

            const price = parseLooseNumber(priceStr);
            if (!Number.isFinite(price) || price <= 0) {
                errors.push(`Row ${rowNum} (${name}): Invalid selling price \"${priceStr}\"`);
                continue;
            }

            let cost = parseLooseNumber(costStr);
            if (!Number.isFinite(cost) || cost < 0) {
                cost = 0;
                if (costStr) errors.push(`Row ${rowNum} (${name}): Invalid food cost \"${costStr}\", defaulted to 0`);
            }

            items.push({ name, price, cost, category });
        }

        return { items, errors };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown parser error";
        return { items: [], errors: [`Failed to parse file: ${message}`] };
    }
}

export async function parseOrderCSV(
    file: File,
    menuItems: MenuItem[],
): Promise<{ orders: Order[]; errors: string[]; stats: { totalRows: number; matchedItems: number; unmatchedItems: string[] } }> {
    try {
        const sheets = await readSpreadsheet(file);
        const targetData = pickSheet(sheets, ["order id", "quantity", "qty", "item name", "timestamp"]);

        const errors: string[] = [];
        const orderMap = new Map<string, { items: OrderItem[]; timestamp: Date; channel: "OFFLINE" | "ZOMATO" | "SWIGGY" | "OTHER" | "CALL" }>();
        const unmatchedSet = new Set<string>();
        let matchedItems = 0;

        for (let i = 0; i < targetData.length; i++) {
            const row = targetData[i];
            const rowNum = i + 2;

            const orderId = getField(row, "Order ID", "order_id", "OrderID") || `CSV-${1000 + i}`;
            const itemName = getField(row, "Item Name", "item_name", "Name", "name");
            const qtyStr = getField(row, "Quantity", "quantity", "qty");
            const timestampStr = getField(row, "Timestamp", "timestamp", "date", "Date");
            const channelStr = getField(row, "Channel", "channel", "Platform", "platform", "Source", "source");

            if (!itemName) {
                if (qtyStr || orderId) errors.push(`Row ${rowNum}: Missing item name`);
                continue;
            }

            const parsedQty = parseLooseNumber(qtyStr);
            const qty = Number.isFinite(parsedQty) && parsedQty > 0 ? Math.round(parsedQty) : 1;

            const parsedTimestamp = timestampStr ? new Date(timestampStr) : new Date();
            const timestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp;

            if (timestampStr && Number.isNaN(parsedTimestamp.getTime())) {
                errors.push(`Row ${rowNum}: Invalid timestamp \"${timestampStr}\", current time used`);
            }

            let channel: "OFFLINE" | "ZOMATO" | "SWIGGY" | "OTHER" | "CALL" = "OFFLINE";
            if (channelStr) {
                const ch = channelStr.toUpperCase().trim();
                if (ch.includes("ZOMATO")) channel = "ZOMATO";
                else if (ch.includes("SWIGGY")) channel = "SWIGGY";
                else if (["CALL", "PHONE"].some((token) => ch.includes(token))) channel = "CALL";
                else if (["OTHER", "OTHER ONLINE"].some((token) => ch.includes(token))) channel = "OTHER";
                else if (["OFFLINE", "DINE-IN", "DINEIN", "DINE IN"].some((token) => ch.includes(token))) channel = "OFFLINE";
                else channel = "OTHER";
            }

            const menuItem = findMenuItemByName(menuItems, itemName);
            if (!menuItem) {
                unmatchedSet.add(itemName);
                continue;
            }

            matchedItems++;

            if (!orderMap.has(orderId)) {
                orderMap.set(orderId, { items: [], timestamp, channel });
            }

            const order = orderMap.get(orderId)!;
            const existing = order.items.find((oi) => oi.menuItemId === menuItem.id);
            if (existing) {
                existing.qty += qty;
            } else {
                order.items.push({
                    menuItemId: menuItem.id,
                    name: menuItem.name,
                    qty,
                    price: menuItem.price,
                    cost: menuItem.cost,
                });
            }
        }

        const orders: Order[] = [];
        for (const [id, data] of orderMap.entries()) {
            if (!data.items.length) continue;

            const total = data.items.reduce((sum, item) => sum + item.price * item.qty, 0);
            const totalCost = data.items.reduce((sum, item) => sum + item.cost * item.qty, 0);

            orders.push({
                id,
                items: data.items,
                total,
                totalCost,
                margin: total > 0 ? ((total - totalCost) / total) * 100 : 0,
                timestamp: data.timestamp,
                channel: data.channel,
            });
        }

        return {
            orders,
            errors,
            stats: {
                totalRows: targetData.length,
                matchedItems,
                unmatchedItems: Array.from(unmatchedSet),
            },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown parser error";
        return {
            orders: [],
            errors: [`Failed to parse file: ${message}`],
            stats: { totalRows: 0, matchedItems: 0, unmatchedItems: [] },
        };
    }
}


