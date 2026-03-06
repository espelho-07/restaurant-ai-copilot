// CSV & Excel Parser utility for importing restaurant data
// Uses papaparse for CSV and xlsx (SheetJS) for Excel
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { MenuItem, Order, OrderItem } from "./types";

// ─── FIELD EXTRACTORS (case-insensitive) ─────────────────────────

function getField(row: Record<string, any>, ...keys: string[]): string {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return String(row[key]).trim();
    }
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        const found = rowKeys.find((k) => k.toLowerCase().replace(/[_\s]/g, "") === key.toLowerCase().replace(/[_\s]/g, ""));
        if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") return String(row[found]).trim();
    }
    return "";
}

// ─── FILE READER UTILITY ─────────────────────────────────────────

async function readSpreadsheet(file: File): Promise<{ sheetName: string; data: any[] }[]> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header: string) => header.trim(),
                complete: (results) => resolve([{ sheetName: "CSV", data: results.data }]),
                error: (error) => reject(error)
            });
        });
    } else {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });

                    const sheets: { sheetName: string; data: any[] }[] = [];
                    for (const sheetName of workbook.SheetNames) {
                        const worksheet = workbook.Sheets[sheetName];
                        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                        // Trim all keys
                        const trimmedJson = json.map((row: any) => {
                            const newRow: any = {};
                            for (const key in row) newRow[key.trim()] = row[key];
                            return newRow;
                        });
                        sheets.push({ sheetName, data: trimmedJson });
                    }
                    resolve(sheets);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }
}

// ─── MENU PARSER ─────────────────────────────────────────────────

export async function parseMenuCSV(file: File): Promise<{ items: Omit<MenuItem, "id">[]; errors: string[] }> {
    try {
        const sheets = await readSpreadsheet(file);

        // Find the most likely menu sheet: has "Selling Price" or "Food Cost"
        let targetData = sheets[0].data;
        for (const sheet of sheets) {
            if (sheet.data.length > 0) {
                const firstRowKeys = Object.keys(sheet.data[0]).map(k => k.toLowerCase().replace(/[_\s]/g, ""));
                if (firstRowKeys.includes("sellingprice") || firstRowKeys.includes("price") || firstRowKeys.includes("foodcost") || firstRowKeys.includes("cost")) {
                    targetData = sheet.data;
                    break;
                }
            }
        }

        const items: Omit<MenuItem, "id">[] = [];
        const errors: string[] = [];

        for (let i = 0; i < targetData.length; i++) {
            const row = targetData[i];
            const rowNum = i + 2;

            const name = getField(row, "Item Name", "item name", "item_name", "Name", "name");
            const priceStr = getField(row, "Selling Price", "selling price", "selling_price", "Price", "price");
            const costStr = getField(row, "Food Cost", "food cost", "food_cost", "Cost", "cost");
            const category = getField(row, "Category", "category") || "Other";

            if (!name) {
                if (priceStr || costStr) errors.push(`Row ${rowNum}: Missing item name`);
                continue;
            }

            const price = parseFloat(priceStr);
            const cost = parseFloat(costStr);

            if (isNaN(price) || price <= 0) {
                errors.push(`Row ${rowNum} (${name}): Invalid selling price "${priceStr}"`);
                continue;
            }
            if (isNaN(cost) || cost < 0) {
                errors.push(`Row ${rowNum} (${name}): Invalid food cost "${costStr}"`);
                continue;
            }

            items.push({ name, price, cost, category });
        }

        return { items, errors };
    } catch (e: any) {
        return { items: [], errors: [`Failed to parse file: ${e.message}`] };
    }
}

// ─── ORDER PARSER ────────────────────────────────────────────────

export async function parseOrderCSV(
    file: File,
    menuItems: MenuItem[]
): Promise<{ orders: Order[]; errors: string[]; stats: { totalRows: number; matchedItems: number; unmatchedItems: string[] } }> {
    try {
        const sheets = await readSpreadsheet(file);

        // Find the most likely order sheet: has "Quantity" or "Order ID"
        let targetData = sheets.length > 1 ? sheets[1].data : sheets[0].data;
        for (const sheet of sheets) {
            if (sheet.data.length > 0) {
                const firstRowKeys = Object.keys(sheet.data[0]).map(k => k.toLowerCase().replace(/[_\s]/g, ""));
                if (firstRowKeys.includes("quantity") || firstRowKeys.includes("qty") || firstRowKeys.includes("orderid")) {
                    targetData = sheet.data;
                    break;
                }
            }
        }

        const errors: string[] = [];
        const orderMap = new Map<string, { items: OrderItem[]; timestamp: Date; channel: "OFFLINE" | "ZOMATO" | "SWIGGY" | "OTHER" }>();
        const unmatchedSet = new Set<string>();
        let matchedItems = 0;

        for (let i = 0; i < targetData.length; i++) {
            const row = targetData[i];
            const rowNum = i + 2;

            const orderId = getField(row, "Order ID", "order id", "order_id", "OrderID") || `CSV-${1000 + i}`;
            const itemName = getField(row, "Item Name", "item name", "item_name", "Name", "name");
            const qtyStr = getField(row, "Quantity", "quantity", "qty");
            const timestampStr = getField(row, "Timestamp", "timestamp", "date", "Date");
            const channelStr = getField(row, "Channel", "channel", "Platform", "platform", "Source", "source");

            if (!itemName) {
                if (qtyStr || orderId) errors.push(`Row ${rowNum}: Missing item name`);
                continue;
            }

            const qty = parseInt(qtyStr) || 1;
            const timestamp = timestampStr ? new Date(timestampStr) : new Date();
            if (isNaN(timestamp.getTime())) {
                errors.push(`Row ${rowNum}: Invalid timestamp "${timestampStr}", using current time`);
            }

            // Parse channel
            let channel: "OFFLINE" | "ZOMATO" | "SWIGGY" | "OTHER" = "OFFLINE";
            if (channelStr) {
                const ch = channelStr.toUpperCase().trim();
                if (ch === "ZOMATO") channel = "ZOMATO";
                else if (ch === "SWIGGY") channel = "SWIGGY";
                else if (ch === "OTHER" || ch === "OTHER ONLINE") channel = "OTHER";
                else if (ch === "OFFLINE" || ch === "DINE-IN" || ch === "DINEIN" || ch === "DINE IN") channel = "OFFLINE";
                else if (ch.includes("ZOMATO")) channel = "ZOMATO";
                else if (ch.includes("SWIGGY")) channel = "SWIGGY";
                else if (ch !== "OFFLINE") channel = "OTHER";
            }

            // Fuzzy match item
            const menuItem = menuItems.find(
                (m) => m.name.toLowerCase() === itemName.toLowerCase() || (m.aliases && m.aliases.some((a) => a.toLowerCase() === itemName.toLowerCase()))
            );

            if (!menuItem) {
                unmatchedSet.add(itemName);
                continue;
            }

            matchedItems++;

            if (!orderMap.has(orderId)) {
                orderMap.set(orderId, { items: [], timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp, channel });
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
            if (data.items.length === 0) continue;
            const total = data.items.reduce((s, i) => s + i.price * i.qty, 0);
            const totalCost = data.items.reduce((s, i) => s + i.cost * i.qty, 0);
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
            stats: { totalRows: targetData.length, matchedItems, unmatchedItems: Array.from(unmatchedSet) },
        };
    } catch (e: any) {
        return { orders: [], errors: [`Failed to parse file: ${e.message}`], stats: { totalRows: 0, matchedItems: 0, unmatchedItems: [] } };
    }
}
