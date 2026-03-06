// ─── AI Voice Ordering Copilot Engine ─────────────────────────────
// Handles: intent recognition, modifier parsing, ambiguity resolution,
// conversation state, upsell/combo suggestions, order editing.

import type {
    MenuItem, Order, VoiceIntent, OrderItemModifier, VoiceOrderItem,
    ConversationMessage, VoiceSessionState, ClarificationQuestion,
    UpsellSuggestion, ComboSuggestion,
} from "./types";

// ─── NUMBER WORDS (English + Hindi) ──────────────────────────────

const numberWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    ek: 1, do: 2, teen: 3, char: 4, paanch: 5, cheh: 6, saat: 7, aath: 8, nau: 9, das: 10,
    a: 1, an: 1, half: 0.5, double: 2,
};

// ─── INTENT PATTERNS ─────────────────────────────────────────────

const intentPatterns: { intent: VoiceIntent; patterns: RegExp[] }[] = [
    {
        intent: "remove_item",
        patterns: [
            /\b(remove|delete|cancel|hata|hatao|nikal|nikalo)\b/i,
            /\bdon'?t want\b/i,
            /\bnahi chahiye\b/i,
            /\b(minus|without)\b/i,
        ],
    },
    {
        intent: "modify_order",
        patterns: [
            /\b(change|modify|update|replace|swap|badal|badlo)\b/i,
            /\binstead of\b/i,
            /\bke jagah\b/i,
            /\b(increase|decrease|kam|zyada)\s+(kar|karo|kijiye)?\b/i,
            /\b(add|aur)\s+(one|ek|1)\s+more\b/i,
        ],
    },
    {
        intent: "confirm_order",
        patterns: [
            /\b(confirm|done|finish|final|yes|haan|ha|theek|thik|okay|ok|sahi|correct|bilkul)\b/i,
            /\bthat'?s? (it|all|correct|right)\b/i,
            /\bbas\s+(itna|yahi)\b/i,
            /\border\s+(confirm|place|kar|karo|kijiye)\b/i,
        ],
    },
    {
        intent: "cancel_order",
        patterns: [
            /\b(cancel|abort|stop|ruk|band|chhodo|chhod)\b/i,
            /\bnahi nahi\b/i,
            /\bcancel (the |my )?order\b/i,
        ],
    },
    {
        intent: "ask_menu",
        patterns: [
            /\b(menu|what do you (have|serve)|kya (hai|milega)|list|items|batao)\b/i,
            /\bwhat('?s| is) (on|in) (the |your )?menu\b/i,
            /\b(show|dikhao) menu\b/i,
        ],
    },
    {
        intent: "ask_price",
        patterns: [
            /\b(price|cost|kitne|kitna|how much|rate|kya rate)\b/i,
            /\bhow much (does|is|for)\b/i,
        ],
    },
    {
        intent: "greeting",
        patterns: [
            /^(hi|hello|hey|namaste|namaskar|good\s+(morning|afternoon|evening))\b/i,
        ],
    },
];

// ─── MODIFIER PATTERNS ──────────────────────────────────────────

const modifierPatterns: { pattern: RegExp; type: OrderItemModifier["type"]; extract: (m: RegExpMatchArray) => string }[] = [
    { pattern: /\b(extra|double|zyada)\s+(\w+)/gi, type: "add", extract: (m) => `extra ${m[2]}` },
    { pattern: /\b(no|without|bina|hata)\s+(\w+)/gi, type: "remove", extract: (m) => `no ${m[2]}` },
    { pattern: /\b(less|kam|thoda)\s+(\w+)/gi, type: "preference", extract: (m) => `less ${m[2]}` },
    { pattern: /\b(add|with)\s+(\w+)\s+(topping|extra)?/gi, type: "add", extract: (m) => `add ${m[2]}` },
    { pattern: /\b(large|big|bada|badi)\b/gi, type: "preference", extract: () => "large" },
    { pattern: /\b(small|chhota|chhoti|mini)\b/gi, type: "preference", extract: () => "small" },
    { pattern: /\b(medium|regular)\b/gi, type: "preference", extract: () => "medium" },
    { pattern: /\b(spicy|teekha|mirchi|jyada mirchi)\b/gi, type: "preference", extract: () => "spicy" },
    { pattern: /\b(mild|kam teekha)\b/gi, type: "preference", extract: () => "mild" },
];

// ─── STOP WORDS ──────────────────────────────────────────────────

const stopWords = new Set([
    "aur", "and", "or", "please", "bhai", "yaar", "dena", "de",
    "chahiye", "lao", "laga", "lagao", "with", "mein", "me", "ka", "ke", "ki",
    "mujhe", "hume", "humko", "i", "want", "would", "like", "to", "order",
    "give", "get", "can", "have", "also", "plus", "the", "some", "then",
    "sir", "madam", "ji", "sahab",
]);

// ─── UTILITIES ───────────────────────────────────────────────────

function normalizeText(text: string): string {
    return text.toLowerCase().replace(/[.,!?;:'"]/g, "").replace(/\s+/g, " ").trim();
}

function fuzzyMatch(input: string, target: string): number {
    const a = input.toLowerCase();
    const b = target.toLowerCase();
    if (a === b) return 1;
    if (b.includes(a) || a.includes(b)) return 0.85;

    const aWords = a.split(" ");
    const bWords = b.split(" ");
    let matched = 0;
    for (const aw of aWords) {
        for (const bw of bWords) {
            if (aw === bw) { matched++; break; }
            if (aw.length > 3 && bw.startsWith(aw)) { matched += 0.8; break; }
            if (bw.length > 3 && aw.startsWith(bw)) { matched += 0.8; break; }
            // Levenshtein for short words
            if (aw.length > 2 && bw.length > 2 && levenshtein(aw, bw) <= 1) { matched += 0.7; break; }
        }
    }
    return matched / Math.max(aWords.length, bWords.length);
}

function levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = b[i - 1] === a[j - 1]
                ? matrix[i - 1][j - 1]
                : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}

function generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function calculateMargin(item: MenuItem): number {
    return item.price > 0 ? ((item.price - item.cost) / item.price) * 100 : 0;
}

// ─── INTENT RECOGNITION ─────────────────────────────────────────

export function detectIntent(text: string): { intent: VoiceIntent; confidence: number } {
    const normalized = normalizeText(text);

    for (const { intent, patterns } of intentPatterns) {
        for (const pattern of patterns) {
            if (pattern.test(normalized)) {
                return { intent, confidence: 0.85 };
            }
        }
    }

    // If text contains food-like words or numbers, it's likely a place_order intent
    const words = normalized.split(" ").filter(w => !stopWords.has(w));
    if (words.length > 0) {
        const hasNumber = words.some(w => /^\d+$/.test(w) || numberWords[w] !== undefined);
        if (hasNumber || words.length >= 1) {
            return { intent: "place_order", confidence: 0.7 };
        }
    }

    return { intent: "unknown", confidence: 0.3 };
}

// ─── MODIFIER EXTRACTION ────────────────────────────────────────

export function extractModifiers(text: string): { modifiers: OrderItemModifier[]; cleanText: string } {
    let cleanText = text;
    const modifiers: OrderItemModifier[] = [];

    for (const { pattern, type, extract } of modifierPatterns) {
        // Reset lastIndex for global regexps
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
            modifiers.push({ type, value: extract(match) });
            cleanText = cleanText.replace(match[0], "").trim();
        }
    }

    return { modifiers, cleanText: cleanText.replace(/\s+/g, " ").trim() };
}

// ─── ITEM MATCHING WITH AMBIGUITY DETECTION ─────────────────────

interface MatchResult {
    items: VoiceOrderItem[];
    unmatched: string[];
    clarifications: ClarificationQuestion[];
}

export function matchMenuItems(
    transcript: string,
    menuItems: MenuItem[]
): MatchResult {
    const normalized = normalizeText(transcript);
    const segments = normalized
        .split(/\b(?:and|aur|or|plus|also|bhi|,)\b/)
        .map(s => s.trim())
        .filter(Boolean);

    const items: VoiceOrderItem[] = [];
    const unmatched: string[] = [];
    const clarifications: ClarificationQuestion[] = [];

    for (let segment of segments) {
        // Remove stop words
        const words = segment.split(" ").filter(w => !stopWords.has(w));
        segment = words.join(" ");
        if (!segment.trim()) continue;

        // Extract quantity
        let qty = 1;
        const firstWord = words[0];
        if (firstWord && /^\d+$/.test(firstWord)) {
            qty = parseInt(firstWord);
            segment = words.slice(1).join(" ");
        } else if (firstWord && numberWords[firstWord] !== undefined) {
            qty = numberWords[firstWord];
            segment = words.slice(1).join(" ");
        }
        if (!segment.trim()) continue;

        // Extract modifiers
        const { modifiers, cleanText } = extractModifiers(segment);
        const searchText = cleanText || segment;

        // Fuzzy match against all menu items
        const scores: { item: MenuItem; score: number }[] = [];
        for (const item of menuItems) {
            const nameScore = fuzzyMatch(searchText, item.name);
            let bestScore = nameScore;
            if (item.aliases) {
                for (const alias of item.aliases) {
                    const aliasScore = fuzzyMatch(searchText, alias);
                    if (aliasScore > bestScore) bestScore = aliasScore;
                }
            }
            if (bestScore > 0.3) {
                scores.push({ item, score: bestScore });
            }
        }

        scores.sort((a, b) => b.score - a.score);

        if (scores.length === 0) {
            unmatched.push(searchText);
            continue;
        }

        const best = scores[0];

        // Clear match — high confidence
        if (best.score >= 0.7) {
            const existing = items.find(i => i.menuItemId === best.item.id);
            if (existing) {
                existing.qty += qty;
                existing.modifiers.push(...modifiers);
            } else {
                items.push({
                    menuItemId: best.item.id,
                    name: best.item.name,
                    qty,
                    price: best.item.price,
                    cost: best.item.cost,
                    modifiers,
                    confidence: best.score,
                });
            }
        }
        // Ambiguous — multiple close candidates
        else if (best.score >= 0.4) {
            const candidates = scores.filter(s => s.score >= best.score * 0.8).slice(0, 4);

            if (candidates.length > 1 && candidates[1].score >= best.score * 0.85) {
                // True ambiguity — ask for clarification
                clarifications.push({
                    phrase: searchText,
                    candidates: candidates.map(c => c.item),
                    resolved: false,
                });
            } else {
                // Single fuzzy match — accept with lower confidence
                const existing = items.find(i => i.menuItemId === best.item.id);
                if (existing) {
                    existing.qty += qty;
                } else {
                    items.push({
                        menuItemId: best.item.id,
                        name: best.item.name,
                        qty,
                        price: best.item.price,
                        cost: best.item.cost,
                        modifiers,
                        confidence: best.score,
                    });
                }
            }
        } else {
            unmatched.push(searchText);
        }
    }

    return { items, unmatched, clarifications };
}

// ─── SMART UPSELL ENGINE ────────────────────────────────────────

export function generateUpsellSuggestions(
    currentItems: VoiceOrderItem[],
    menuItems: MenuItem[],
    orders: Order[]
): UpsellSuggestion[] {
    if (currentItems.length === 0 || orders.length < 2) return [];

    const currentIds = new Set(currentItems.map(i => i.menuItemId));
    const suggestions: UpsellSuggestion[] = [];

    // Build co-occurrence map
    const coOccurrence = new Map<string, number>();
    for (const order of orders) {
        const ids = Array.from(new Set(order.items.map(i => i.menuItemId)));
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const key = `${Math.min(ids[i], ids[j])}-${Math.max(ids[i], ids[j])}`;
                coOccurrence.set(key, (coOccurrence.get(key) || 0) + 1);
            }
        }
    }

    for (const currentItem of currentItems) {
        // Find orders containing this item
        const ordersWithItem = orders.filter(o =>
            o.items.some(oi => oi.menuItemId === currentItem.menuItemId)
        );
        if (ordersWithItem.length === 0) continue;

        for (const candidate of menuItems) {
            if (currentIds.has(candidate.id)) continue;
            if (suggestions.some(s => s.item.id === candidate.id)) continue;

            const key = `${Math.min(currentItem.menuItemId, candidate.id)}-${Math.max(currentItem.menuItemId, candidate.id)}`;
            const coCount = coOccurrence.get(key) || 0;
            if (coCount < 1) continue;

            const confidence = coCount / ordersWithItem.length;
            const marginPct = calculateMargin(candidate);
            const score = confidence * 0.6 + (marginPct / 100) * 0.4;

            if (score > 0.15) {
                suggestions.push({
                    item: candidate,
                    reason: `${Math.round(confidence * 100)}% of customers who ordered ${currentItem.name} also added ${candidate.name}. ${marginPct.toFixed(0)}% margin.`,
                    confidence: Math.round(confidence * 100),
                    marginPct: Math.round(marginPct),
                });
            }
        }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

// ─── COMBO DETECTOR ─────────────────────────────────────────────

export function detectCombos(
    currentItems: VoiceOrderItem[],
    menuItems: MenuItem[],
    orders: Order[]
): ComboSuggestion[] {
    if (currentItems.length < 1 || orders.length < 2) return [];

    const currentIds = new Set(currentItems.map(i => i.menuItemId));
    const combos: ComboSuggestion[] = [];

    // Find popular 2-3 item combos from order history
    const pairCount = new Map<string, { ids: number[]; count: number }>();

    for (const order of orders) {
        const uniqueIds = Array.from(new Set(order.items.map(i => i.menuItemId))).sort((a, b) => a - b);
        // Check pairs
        for (let i = 0; i < uniqueIds.length; i++) {
            for (let j = i + 1; j < uniqueIds.length; j++) {
                const key = `${uniqueIds[i]}-${uniqueIds[j]}`;
                const existing = pairCount.get(key);
                if (existing) existing.count++;
                else pairCount.set(key, { ids: [uniqueIds[i], uniqueIds[j]], count: 1 });

                // Check triples
                for (let k = j + 1; k < uniqueIds.length; k++) {
                    const tripleKey = `${uniqueIds[i]}-${uniqueIds[j]}-${uniqueIds[k]}`;
                    const ex = pairCount.get(tripleKey);
                    if (ex) ex.count++;
                    else pairCount.set(tripleKey, { ids: [uniqueIds[i], uniqueIds[j], uniqueIds[k]], count: 1 });
                }
            }
        }
    }

    // Find combos that include at least one current item
    for (const [, combo] of pairCount) {
        if (combo.count < 2) continue;
        const hasCurrentItem = combo.ids.some(id => currentIds.has(id));
        if (!hasCurrentItem) continue;

        const comboMenuItems = combo.ids.map(id => menuItems.find(m => m.id === id)).filter(Boolean) as MenuItem[];
        if (comboMenuItems.length !== combo.ids.length) continue;

        const individualTotal = comboMenuItems.reduce((s, m) => s + m.price, 0);
        const discount = Math.round(individualTotal * 0.1 / 5) * 5; // 10% discount rounded to 5
        const comboPrice = individualTotal - discount;

        if (discount < 10) continue; // Not worth suggesting

        combos.push({
            items: comboMenuItems,
            comboPrice,
            individualTotal,
            savings: discount,
            reason: `Popular combo ordered ${combo.count} times. Save ₹${discount}!`,
        });
    }

    return combos.sort((a, b) => b.savings - a.savings).slice(0, 2);
}

// ─── ORDER EDITING ──────────────────────────────────────────────

export function removeItemFromOrder(
    items: VoiceOrderItem[],
    text: string,
    menuItems: MenuItem[]
): { updatedItems: VoiceOrderItem[]; removed: string | null } {
    const normalized = normalizeText(text);
    // Remove keywords
    const cleanText = normalized
        .replace(/\b(remove|delete|cancel|hata|hatao|nikal|nikalo|minus|don'?t want|nahi chahiye)\b/gi, "")
        .replace(/\b(the|my|one|ek)\b/gi, "")
        .trim();

    if (!cleanText) return { updatedItems: items, removed: null };

    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < items.length; i++) {
        const score = fuzzyMatch(cleanText, items[i].name);
        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    }

    if (bestIdx >= 0 && bestScore >= 0.4) {
        const removed = items[bestIdx].name;
        const updatedItems = items.filter((_, i) => i !== bestIdx);
        return { updatedItems, removed };
    }

    return { updatedItems: items, removed: null };
}

export function modifyItemQuantity(
    items: VoiceOrderItem[],
    text: string
): { updatedItems: VoiceOrderItem[]; modified: string | null } {
    const normalized = normalizeText(text);

    // Try "add one more burger" / "ek aur burger"
    const addMore = normalized.match(/\b(?:add|aur|one more|ek aur|increase)\b.*?(\w[\w\s]*)/i);
    if (addMore) {
        const searchText = addMore[1].trim();
        for (let i = 0; i < items.length; i++) {
            if (fuzzyMatch(searchText, items[i].name) >= 0.5) {
                items[i].qty += 1;
                return { updatedItems: [...items], modified: `${items[i].name} → ${items[i].qty}` };
            }
        }
    }

    return { updatedItems: items, modified: null };
}

// ─── CONVERSATION RESPONSE GENERATOR ────────────────────────────

export function generateAIResponse(
    intent: VoiceIntent,
    items: VoiceOrderItem[],
    clarifications: ClarificationQuestion[],
    unmatched: string[],
    menuItems: MenuItem[],
    language: "en-IN" | "hi-IN"
): string {
    const isHindi = language === "hi-IN";

    switch (intent) {
        case "greeting":
            return isHindi
                ? "🙏 नमस्ते! आपका ऑर्डर बताइए।"
                : "👋 Hello! What would you like to order?";

        case "ask_menu": {
            const categories = [...new Set(menuItems.map(m => m.category))];
            const categoryList = categories.slice(0, 5).join(", ");
            return isHindi
                ? `📋 हमारे मेन्यू में ${menuItems.length} आइटम हैं: ${categoryList}। कुछ भी बोलिए!`
                : `📋 We have ${menuItems.length} items across: ${categoryList}. What would you like?`;
        }

        case "ask_price": {
            if (items.length > 0) {
                const priceList = items.map(i => `${i.name}: ₹${i.price}`).join(", ");
                return isHindi
                    ? `💰 ${priceList}`
                    : `💰 ${priceList}`;
            }
            return isHindi
                ? "कौन से आइटम का प्राइस जानना है?"
                : "Which item's price would you like to know?";
        }

        case "confirm_order": {
            if (items.length === 0) {
                return isHindi
                    ? "अभी तक कोई आइटम नहीं है। पहले ऑर्डर बताइए।"
                    : "No items in your order yet. Please tell me what you'd like.";
            }
            const total = items.reduce((s, i) => s + i.price * i.qty, 0);
            const summary = items.map(i => `${i.qty}x ${i.name}`).join(", ");
            return isHindi
                ? `✅ आपका ऑर्डर: ${summary}। कुल ₹${total}। कन्फर्म करूं?`
                : `✅ Your order: ${summary}. Total ₹${total}. Shall I confirm?`;
        }

        case "cancel_order":
            return isHindi
                ? "❌ ऑर्डर कैंसल कर दिया गया।"
                : "❌ Order cancelled.";

        case "remove_item":
            return isHindi
                ? "कौन सा आइटम हटाऊं?"
                : "Which item should I remove?";

        case "place_order": {
            if (clarifications.length > 0) {
                const q = clarifications[0];
                const options = q.candidates.map(c => c.name).join(isHindi ? " या " : " or ");
                return isHindi
                    ? `🤔 "${q.phrase}" — कौन सा चाहिए? ${options}?`
                    : `🤔 "${q.phrase}" — which one? ${options}?`;
            }
            if (unmatched.length > 0) {
                return isHindi
                    ? `⚠️ "${unmatched.join('", "')}" मेन्यू में नहीं मिला। सही नाम बताइए।`
                    : `⚠️ "${unmatched.join('", "')}" not found in menu. Could you rephrase?`;
            }
            if (items.length > 0) {
                const total = items.reduce((s, i) => s + i.price * i.qty, 0);
                return isHindi
                    ? `👍 ${items.length} आइटम — ₹${total}। और कुछ? या "कन्फर्म" बोलें।`
                    : `👍 ${items.length} item(s) — ₹${total}. Anything else? Or say "confirm".`;
            }
            return isHindi
                ? "क्या ऑर्डर करना है बताइए।"
                : "What would you like to order?";
        }

        default:
            return isHindi
                ? "माफ कीजिए, समझ नहीं आया। फिर से बताइए।"
                : "Sorry, I didn't catch that. Could you repeat?";
    }
}

// ─── ORDER SUMMARY TEXT ─────────────────────────────────────────

export function generateOrderSummary(
    items: VoiceOrderItem[],
    language: "en-IN" | "hi-IN"
): string {
    if (items.length === 0) return "";

    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const isHindi = language === "hi-IN";

    const itemList = items.map(i => {
        const modStr = i.modifiers.length > 0
            ? ` (${i.modifiers.map(m => m.value).join(", ")})`
            : "";
        return `${i.qty}× ${i.name}${modStr} — ₹${i.price * i.qty}`;
    });

    if (isHindi) {
        return `📋 आपका ऑर्डर:\n${itemList.join("\n")}\n\n💰 कुल: ₹${total}`;
    }
    return `📋 Your order:\n${itemList.join("\n")}\n\n💰 Total: ₹${total}`;
}

// ─── STRUCTURED JSON OUTPUT ─────────────────────────────────────

export function generateStructuredOutput(
    items: VoiceOrderItem[],
    language: "en-IN" | "hi-IN",
    transcript: string,
    confirmed: boolean,
    orderId: string | null,
    upsells: UpsellSuggestion[]
) {
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    return {
        order_id: orderId || "pending",
        source: "voice_copilot",
        language: language === "hi-IN" ? "Hindi / Hinglish" : "English",
        transcript,
        items: items.map(i => ({
            name: i.name,
            quantity: i.qty,
            unit_price: i.price,
            subtotal: i.price * i.qty,
            modifiers: i.modifiers.map(m => m.value),
            confidence: Math.round(i.confidence * 100) + "%",
        })),
        total,
        overall_confidence: items.length > 0
            ? Math.round((items.reduce((s, i) => s + i.confidence, 0) / items.length) * 100) + "%"
            : "0%",
        upsell_suggested: upsells.length > 0
            ? upsells.map(u => `${u.item.name} (₹${u.item.price})`).join(", ")
            : null,
        status: confirmed ? "confirmed_pos_push" : "awaiting_confirmation",
        timestamp: new Date().toISOString(),
    };
}

// ─── PROCESS FULL TRANSCRIPT ────────────────────────────────────
// Main entry point: takes transcript text, returns full analysis

export interface ProcessResult {
    intent: VoiceIntent;
    intentConfidence: number;
    items: VoiceOrderItem[];
    unmatched: string[];
    clarifications: ClarificationQuestion[];
    aiResponse: string;
    upsells: UpsellSuggestion[];
    combos: ComboSuggestion[];
}

export function processTranscript(
    transcript: string,
    menuItems: MenuItem[],
    orders: Order[],
    existingItems: VoiceOrderItem[],
    language: "en-IN" | "hi-IN"
): ProcessResult {
    const { intent, confidence: intentConfidence } = detectIntent(transcript);

    // Handle remove intent
    if (intent === "remove_item" && existingItems.length > 0) {
        const { updatedItems, removed } = removeItemFromOrder(existingItems, transcript, menuItems);
        const aiResponse = removed
            ? (language === "hi-IN" ? `✅ ${removed} हटा दिया।` : `✅ Removed ${removed}.`)
            : (language === "hi-IN" ? "कौन सा आइटम हटाऊं?" : "Which item should I remove?");
        return {
            intent, intentConfidence,
            items: updatedItems,
            unmatched: [],
            clarifications: [],
            aiResponse,
            upsells: [],
            combos: [],
        };
    }

    // Handle modify intent
    if (intent === "modify_order" && existingItems.length > 0) {
        const { updatedItems, modified } = modifyItemQuantity(existingItems, transcript);
        const aiResponse = modified
            ? (language === "hi-IN" ? `✅ ${modified} अपडेट किया।` : `✅ Updated: ${modified}`)
            : (language === "hi-IN" ? "क्या बदलना है?" : "What would you like to change?");
        return {
            intent, intentConfidence,
            items: updatedItems,
            unmatched: [],
            clarifications: [],
            aiResponse,
            upsells: [],
            combos: [],
        };
    }

    // For place_order or unknown, try to match items
    let items = [...existingItems];
    let unmatched: string[] = [];
    let clarifications: ClarificationQuestion[] = [];

    if (intent === "place_order" || intent === "unknown") {
        const result = matchMenuItems(transcript, menuItems);
        // Merge new items with existing
        for (const newItem of result.items) {
            const existing = items.find(i => i.menuItemId === newItem.menuItemId);
            if (existing) {
                existing.qty += newItem.qty;
                existing.modifiers.push(...newItem.modifiers);
            } else {
                items.push(newItem);
            }
        }
        unmatched = result.unmatched;
        clarifications = result.clarifications;
    }

    // Generate upsells and combos
    const upsells = generateUpsellSuggestions(items, menuItems, orders);
    const combos = detectCombos(items, menuItems, orders);

    // Generate AI response
    const aiResponse = generateAIResponse(
        intent, items, clarifications, unmatched, menuItems, language
    );

    return {
        intent,
        intentConfidence,
        items,
        unmatched,
        clarifications,
        aiResponse,
        upsells,
        combos,
    };
}

// ─── INITIAL SESSION STATE ──────────────────────────────────────

export function createInitialState(language: "en-IN" | "hi-IN" = "en-IN"): VoiceSessionState {
    return {
        status: "idle",
        messages: [],
        currentItems: [],
        clarifications: [],
        upsells: [],
        combos: [],
        failureCount: 0,
        overallConfidence: 0,
        language,
        orderId: null,
    };
}
