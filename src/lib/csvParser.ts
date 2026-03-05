// CSV Parser utility for importing restaurant data
// Uses papaparse for browser-side CSV parsing (no backend needed)

import Papa from "papaparse";
import type { MenuItem, Order, OrderItem } from "./types";

interface MenuRow {
    "Item Name"?: string;
    "item name"?: string;
    "item_name"?: string;
    "Name"?: string;
    "name"?: string;
    "Selling Price"?: string;
    "selling price"?: string;
    "selling_price"?: string;
    "Price"?: string;
    "price"?: string;
    "Food Cost"?: string;
    "food cost"?: string;
    "food_cost"?: string;
    "Cost"?: string;
    "cost"?: string;
    "Category"?: string;
    "category"?: string;
}

interface OrderRow {
    "Order ID"?: string;
    "order id"?: string;
    "order_id"?: string;
    "OrderID"?: string;
    "Item Name"?: string;
    "item name"?: string;
    "item_name"?: string;
    "Name"?: string;
    "name"?: string;
    "Quantity"?: string;
    "quantity"?: string;
    "qty"?: string;
    "Timestamp"?: string;
    "timestamp"?: string;
    "date"?: string;
    "Date"?: string;
}

// ─── FIELD EXTRACTORS (case-insensitive) ─────────────────────────

function getField(row: Record<string, string>, ...keys: string[]): string {
    for (const key of keys) {
        // Try exact match first
        if (row[key] !== undefined && row[key] !== "") return row[key];
    }
    // Try case-insensitive
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        const found = rowKeys.find((k) => k.toLowerCase().replace(/[_\s]/g, "") === key.toLowerCase().replace(/[_\s]/g, ""));
        if (found && row[found] !== undefined && row[found] !== "") return row[found];
    }
    return "";
}

// ─── MENU CSV PARSER ─────────────────────────────────────────────

export function parseMenuCSV(file: File): Promise<{ items: Omit<MenuItem, "id">[]; errors: string[] }> {
    return new Promise((resolve) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim(),
            complete: (results) => {
                const items: Omit<MenuItem, "id">[] = [];
                const errors: string[] = [];

                for (let i = 0; i < results.data.length; i++) {
                    const row = results.data[i] as Record<string, string>;
                    const rowNum = i + 2; // +2 for header row + 1-indexed

                    const name = getField(row, "Item Name", "item name", "item_name", "Name", "name");
                    const priceStr = getField(row, "Selling Price", "selling price", "selling_price", "Price", "price");
                    const costStr = getField(row, "Food Cost", "food cost", "food_cost", "Cost", "cost");
                    const category = getField(row, "Category", "category") || "Other";

                    if (!name) {
                        errors.push(`Row ${rowNum}: Missing item name`);
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

                    items.push({ name: name.trim(), price, cost, category: category.trim() });
                }

                resolve({ items, errors });
            },
            error: (error) => {
                resolve({ items: [], errors: [`Failed to parse file: ${error.message}`] });
            },
        });
    });
}

// ─── ORDER CSV PARSER ────────────────────────────────────────────

export function parseOrderCSV(
    file: File,
    menuItems: MenuItem[]
): Promise<{ orders: Order[]; errors: string[]; stats: { totalRows: number; matchedItems: number; unmatchedItems: string[] } }> {
    return new Promise((resolve) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim(),
            complete: (results) => {
                const errors: string[] = [];
                const orderMap = new Map<string, { items: OrderItem[]; timestamp: Date }>();
                const unmatchedSet = new Set<string>();
                let matchedItems = 0;

                for (let i = 0; i < results.data.length; i++) {
                    const row = results.data[i] as Record<string, string>;
                    const rowNum = i + 2;

                    const orderId = getField(row, "Order ID", "order id", "order_id", "OrderID") || `CSV-${1000 + i}`;
                    const itemName = getField(row, "Item Name", "item name", "item_name", "Name", "name");
                    const qtyStr = getField(row, "Quantity", "quantity", "qty");
                    const timestampStr = getField(row, "Timestamp", "timestamp", "date", "Date");

                    if (!itemName) {
                        errors.push(`Row ${rowNum}: Missing item name`);
                        continue;
                    }

                    const qty = parseInt(qtyStr) || 1;
                    const timestamp = timestampStr ? new Date(timestampStr) : new Date();
                    if (isNaN(timestamp.getTime())) {
                        errors.push(`Row ${rowNum}: Invalid timestamp "${timestampStr}", using current time`);
                    }

                    // Fuzzy match item name to menu
                    const menuItem = menuItems.find(
                        (m) =>
                            m.name.toLowerCase() === itemName.toLowerCase().trim() ||
                            (m.aliases && m.aliases.some((a) => a.toLowerCase() === itemName.toLowerCase().trim()))
                    );

                    if (!menuItem) {
                        unmatchedSet.add(itemName.trim());
                        continue;
                    }

                    matchedItems++;

                    if (!orderMap.has(orderId)) {
                        orderMap.set(orderId, { items: [], timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp });
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

                // Convert map to Order[]
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
                    });
                }

                resolve({
                    orders,
                    errors,
                    stats: {
                        totalRows: results.data.length,
                        matchedItems,
                        unmatchedItems: Array.from(unmatchedSet),
                    },
                });
            },
            error: (error) => {
                resolve({
                    orders: [],
                    errors: [`Failed to parse file: ${error.message}`],
                    stats: { totalRows: 0, matchedItems: 0, unmatchedItems: [] },
                });
            },
        });
    });
}
