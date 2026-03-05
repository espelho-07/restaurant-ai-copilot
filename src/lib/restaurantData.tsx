import React, { createContext, useContext, useState, useCallback } from "react";
import type { MenuItem, Order, OrderItem } from "./types";

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

// Seed historical orders to bootstrap the AI engine
function generateSeedOrders(menu: MenuItem[]): Order[] {
    const orders: Order[] = [];
    const combos = [
        [1, 10, 11],  // Butter Chicken + Naan + Lassi
        [4, 7, 8],    // Burger + Fries + Coke
        [3, 10],      // Biryani + Naan
        [1, 10, 9],   // Butter Chicken + Naan + Gulab Jamun
        [4, 8],       // Burger + Coke
        [5, 11],      // Dosa + Lassi
        [6, 10],      // Dal Makhani + Naan
        [2, 10, 11],  // Paneer Tikka + Naan + Lassi
        [4, 7],       // Burger + Fries
        [1, 6, 10],   // Butter Chicken + Dal + Naan
        [3, 8],       // Biryani + Coke
        [12, 8],      // Fish Fry + Coke
        [2, 8],       // Paneer Tikka + Coke
        [5, 8],       // Dosa + Coke
        [4, 7, 8],    // Burger + Fries + Coke (repeated — common combo)
        [1, 10],      // Butter Chicken + Naan (repeated — common)
        [4, 7, 8],    // Burger + Fries + Coke
        [1, 10, 11],  // Butter Chicken + Naan + Lassi
        [6, 10, 9],   // Dal + Naan + Gulab Jamun
        [3, 10, 8],   // Biryani + Naan + Coke
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
            items,
            total,
            totalCost,
            margin: ((total - totalCost) / total) * 100,
            timestamp: new Date(now - (combos.length - i) * 3600000 * Math.random() * 24),
        });
    });

    return orders;
}

// ─── CONTEXT ──────────────────────────────────────────────────────

interface RestaurantDataContextType {
    menuItems: MenuItem[];
    orders: Order[];
    addMenuItem: (item: Omit<MenuItem, "id">) => void;
    addOrder: (items: OrderItem[]) => Order;
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
}

const RestaurantDataContext = createContext<RestaurantDataContextType | null>(null);

export function RestaurantDataProvider({ children }: { children: React.ReactNode }) {
    const [menuItems, setMenuItems] = useState<MenuItem[]>(seedMenuItems);
    const [orders, setOrders] = useState<Order[]>(() => generateSeedOrders(seedMenuItems));
    const [nextId, setNextId] = useState(13);

    const addMenuItem = useCallback(
        (item: Omit<MenuItem, "id">) => {
            setMenuItems((prev) => [{ ...item, id: nextId }, ...prev]);
            setNextId((id) => id + 1);
        },
        [nextId]
    );

    const addOrder = useCallback(
        (items: OrderItem[]) => {
            const total = items.reduce((s, i) => s + i.price * i.qty, 0);
            const totalCost = items.reduce((s, i) => s + i.cost * i.qty, 0);
            const order: Order = {
                id: `ORD-${1000 + orders.length}`,
                items,
                total,
                totalCost,
                margin: total > 0 ? ((total - totalCost) / total) * 100 : 0,
                timestamp: new Date(),
            };
            setOrders((prev) => [order, ...prev]);
            return order;
        },
        [orders.length]
    );

    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return (
        <RestaurantDataContext.Provider
            value={{ menuItems, orders, addMenuItem, addOrder, totalRevenue, totalOrders, avgOrderValue }}
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
