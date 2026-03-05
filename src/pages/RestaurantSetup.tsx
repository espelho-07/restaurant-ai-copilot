import { DashboardNav } from "@/components/DashboardNav";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Store,
  MapPin,
  UtensilsCrossed,
  CheckCircle2,
  Terminal,
  Sparkles,
  ArrowRight,
  Upload,
  FileSpreadsheet,
  PlusCircle,
  ShoppingCart,
  AlertCircle,
  Globe,
  Trash2,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRestaurantData } from "@/lib/restaurantData";
import { parseMenuCSV, parseOrderCSV } from "@/lib/csvParser";
import { toast } from "sonner";

const cuisineTypes = [
  "North Indian", "South Indian", "Chinese", "Italian",
  "Multi-Cuisine", "Fast Food", "Cafe & Bakery", "Street Food",
];

const RestaurantSetup = () => {
  const { menuItems, orders, importMenuItems, importOrders, addMenuItem, removeMenuItem, addOrder, updateProfile, profile, commissions, updateCommission } = useRestaurantData();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile.setupComplete) {
      navigate('/dashboard');
    }
  }, [profile.setupComplete, navigate]);

  const [step, setStep] = useState(1);
  const [usesPOS, setUsesPOS] = useState<boolean | null>(null);

  // Sync animation
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);

  // File upload state
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [menuParseResult, setMenuParseResult] = useState<{ count: number; errors: string[] } | null>(null);
  const [orderParseResult, setOrderParseResult] = useState<{ count: number; errors: string[]; unmatched: string[] } | null>(null);

  const [form, setForm] = useState({
    name: profile.name || "",
    location: profile.location || "",
    cuisine: profile.cuisine || "",
  });
  const [formErrors, setFormErrors] = useState<{ name?: string; location?: string }>({});

  // No-POS inline form state
  const [manualItem, setManualItem] = useState({ name: "", price: "", cost: "", category: "" });
  const [manualItemErrors, setManualItemErrors] = useState<Record<string, string>>({});
  const [manualOrder, setManualOrder] = useState<{ itemId: string; qty: string; channel: string }>({ itemId: "", qty: "1", channel: "OFFLINE" });

  const setupCategoryOptions = [
    "Main Course", "Starters", "Breads", "Rice", "Beverages", "Desserts",
    "Fast Food", "Pizza", "Burger", "Sandwich", "Biryani", "Chinese",
    "Snacks", "Fries", "Shakes", "Ice Cream", "Sweets", "Other",
  ];

  const validateStep1 = () => {
    const errors: { name?: string; location?: string } = {};
    if (!form.name.trim()) errors.name = "Restaurant name is required.";
    if (!form.location.trim()) errors.location = "Location is required.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── FILE HANDLERS ──────────────────────────────────────────────

  const handleMenuUpload = useCallback(async (file: File) => {
    const validExts = [".csv", ".xlsx", ".xls"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) {
      toast.error("Invalid file format", { description: `Expected CSV or Excel file, got "${ext}". Please upload a .csv, .xlsx, or .xls file.` });
      return;
    }
    try {
      setMenuFile(file);
      const result = await parseMenuCSV(file);

      if (result.items.length === 0) {
        setMenuParseResult({ count: 0, errors: result.errors.length > 0 ? result.errors : ["No valid menu items found. Make sure your file has columns: Item Name, Selling Price, Food Cost, Category."] });
        toast.error("Could not parse menu file", { description: "Check that your file has the required columns." });
        return;
      }

      const { added, duplicates } = await importMenuItems(result.items);
      setMenuParseResult({
        count: added,
        errors: [
          ...result.errors,
          ...(duplicates > 0 ? [`${duplicates} duplicate items skipped.`] : []),
        ],
      });
      toast.success(`${added} menu items imported!`, {
        description: duplicates > 0 ? `${duplicates} duplicates skipped` : undefined,
      });
    } catch (err: any) {
      toast.error("Failed to read file", { description: err?.message || "The file might be corrupted or in an unsupported format. Try re-saving as CSV." });
      setMenuFile(null);
    }
  }, [importMenuItems]);

  const handleOrderUpload = useCallback(async (file: File) => {
    const validExts = [".csv", ".xlsx", ".xls"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) {
      toast.error("Invalid file format", { description: `Expected CSV or Excel file, got "${ext}". Please upload a .csv, .xlsx, or .xls file.` });
      return;
    }
    if (menuItems.length === 0) {
      toast.error("Add menu items first", { description: "Order data needs menu items to match against. Add your menu items before uploading orders." });
      return;
    }
    try {
      setOrderFile(file);
      const result = await parseOrderCSV(file, menuItems);

      if (result.orders.length === 0) {
        setOrderParseResult({
          count: 0,
          errors: result.errors.length > 0 ? result.errors : ["No valid orders found. Make sure item names match your menu."],
          unmatched: result.stats.unmatchedItems,
        });
        toast.error("Could not parse order file", { description: "Item names in the file didn't match any menu items." });
        return;
      }

      const count = await importOrders(result.orders);
      setOrderParseResult({
        count,
        errors: result.errors,
        unmatched: result.stats.unmatchedItems,
      });
      toast.success(`${count} orders imported!`, {
        description: `${result.stats.matchedItems} item matches across ${result.stats.totalRows} rows`,
      });
    } catch (err: any) {
      toast.error("Failed to read file", { description: err?.message || "The file might be corrupted. Try re-saving as CSV." });
      setOrderFile(null);
    }
  }, [menuItems, importOrders]);

  const handleFileDrop = useCallback((e: React.DragEvent, type: "menu" | "order") => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (type === "menu") handleMenuUpload(file);
    else handleOrderUpload(file);
  }, [handleMenuUpload, handleOrderUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: "menu" | "order") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === "menu") handleMenuUpload(file);
    else handleOrderUpload(file);
  }, [handleMenuUpload, handleOrderUpload]);

  // ─── STEP 3 SYNC ANIMATION ─────────────────────────────────────

  const startSync = () => {
    // Save profile
    updateProfile({
      name: form.name, location: form.location, cuisine: form.cuisine,
      usesPOS: usesPOS === true, setupComplete: true,
    });

    setSyncing(true);
    setVisibleLogs([]);
    setProgress(0);

    // Dynamic logs based on what actually happened
    const logs: string[] = [
      `Connecting to AI Revenue Intelligence Engine...`,
      `Authentication successful ✓`,
      `Loading restaurant profile: ${form.name || "Restaurant"}...`,
    ];

    if (usesPOS && menuParseResult && menuParseResult.count > 0) {
      logs.push(`Importing uploaded menu data (${menuParseResult.count} items)...`);
    } else {
      logs.push(`Loading menu database (${menuItems.length} items)...`);
    }

    const categories = Array.from(new Set(menuItems.map((m) => m.category)));
    categories.forEach((cat) => {
      const count = menuItems.filter((m) => m.category === cat).length;
      logs.push(`  → ${cat} (${count} items) ✓`);
    });

    if (usesPOS && orderParseResult && orderParseResult.count > 0) {
      logs.push(`Importing uploaded order history (${orderParseResult.count} orders)...`);
    } else {
      logs.push(`Loading order history...`);
    }

    logs.push(`Calculating profit margins for ${menuItems.length} items...`);
    logs.push(`Running co-occurrence analysis on order data...`);
    logs.push(`Building price optimization model...`);
    logs.push(`Generating AI insights & recommendations...`);
    logs.push(`Calculating confidence scores...`);
    logs.push(`✅ Setup complete — AI Revenue Copilot ready!`);

    logs.forEach((log, i) => {
      setTimeout(() => {
        setVisibleLogs((prev) => [...prev, log]);
        setProgress(((i + 1) / logs.length) * 100);
        if (i === logs.length - 1) setSyncDone(true);
      }, (i + 1) * 600);
    });
  };

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [visibleLogs]);

  // ─── RENDER ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold">Restaurant Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your restaurant and import your data to activate AI insights.
          </p>
        </motion.div>

        {/* Step Indicator */}
        <div className="mt-8 flex items-center gap-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                {s === 1 ? "Profile" : s === 2 ? "Import Data" : "Activate AI"}
              </span>
              {s < 3 && <div className="h-px w-8 bg-border sm:w-16" />}
            </div>
          ))}
        </div>

        {/* ─── Step 1: Profile ─── */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-8 glass-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-semibold">Restaurant Profile</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Restaurant Name <span className="text-destructive">*</span></label>
                <div className="relative mt-1.5">
                  <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input id="setup-name" type="text" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); if (e.target.value.trim()) setFormErrors(p => ({ ...p, name: undefined })); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("setup-location")?.focus(); } }} placeholder="e.g. Spice Garden" className={`w-full rounded-xl border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${formErrors.name ? 'border-destructive focus:ring-destructive/20' : 'border-border'}`} />
                </div>
                {formErrors.name && <p className="mt-1 text-[11px] text-destructive">{formErrors.name}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Location <span className="text-destructive">*</span></label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input id="setup-location" type="text" value={form.location} onChange={(e) => { setForm({ ...form, location: e.target.value }); if (e.target.value.trim()) setFormErrors(p => ({ ...p, location: undefined })); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("setup-cuisine")?.focus(); } }} placeholder="e.g. Koramangala, Bangalore" className={`w-full rounded-xl border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${formErrors.location ? 'border-destructive focus:ring-destructive/20' : 'border-border'}`} />
                </div>
                {formErrors.location && <p className="mt-1 text-[11px] text-destructive">{formErrors.location}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cuisine Type</label>
                <div className="relative mt-1.5">
                  <UtensilsCrossed className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select id="setup-cuisine" value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} className="w-full appearance-none rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">Select cuisine type</option>
                    {cuisineTypes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-accent" />
                <h3 className="font-display text-sm font-semibold">Online Delivery Platforms</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Set your commission rates to get accurate online profitability insights.</p>
              <div className="space-y-3">
                {commissions.filter(c => c.channel !== "OFFLINE").map((c) => (
                  <div key={c.channel} className="flex items-center justify-between rounded-xl border border-border bg-secondary/20 p-3">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={c.enabled} onChange={(e) => updateCommission(c.channel, { enabled: e.target.checked })} className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary" />
                      <span className="text-sm font-semibold">{c.label}</span>
                    </div>
                    {c.enabled && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Commission %</span>
                        <input type="number" value={c.commissionPct} onChange={(e) => updateCommission(c.channel, { commissionPct: Number(e.target.value) })} className="w-16 rounded-lg border border-border bg-card py-1 px-2 text-sm font-semibold text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary/20" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => { if (validateStep1()) setStep(2); }} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* ─── Step 2: Data Import ─── */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-8 space-y-6">

            {/* POS Toggle */}
            <div className="glass-card p-6">
              <h2 className="font-display text-sm font-semibold mb-4">Do you currently use a POS system?</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setUsesPOS(true)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all ${usesPOS === true ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <FileSpreadsheet className={`h-8 w-8 ${usesPOS === true ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-semibold">Yes — I use a POS</span>
                  <span className="text-xs text-muted-foreground">Upload your existing data</span>
                </button>
                <button
                  onClick={() => setUsesPOS(false)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all ${usesPOS === false ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <PlusCircle className={`h-8 w-8 ${usesPOS === false ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-semibold">No — I don't use a POS</span>
                  <span className="text-xs text-muted-foreground">Create your data manually</span>
                </button>
              </div>
            </div>

            {/* YES PATH — CSV Upload */}
            {usesPOS === true && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
                <div className="insight-card">
                  <div className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" /><span className="text-xs font-semibold text-accent">How it works</span></div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Upload your menu and order history as CSV or Excel files. Our AI will analyze the data and generate revenue insights immediately.</p>
                </div>

                {/* Menu Upload */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Upload Menu Data</h3>
                    {menuParseResult && menuParseResult.count > 0 && <CheckCircle2 className="ml-auto h-4 w-4 text-success" />}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Required columns: Item Name, Selling Price, Food Cost, Category</p>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleFileDrop(e, "menu")}
                    className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-8 transition-colors hover:border-primary/40"
                  >
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">{menuFile ? menuFile.name : "Drag & drop your menu CSV here"}</p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFileSelect(e, "menu")} className="absolute inset-0 cursor-pointer opacity-0" />
                  </div>

                  {menuParseResult && (
                    <div className={`mt-3 rounded-lg p-3 text-xs ${menuParseResult.count > 0 ? "bg-success/5 text-success" : "bg-destructive/5 text-destructive"}`}>
                      {menuParseResult.count > 0 ? `✓ ${menuParseResult.count} items imported successfully` : "✗ No items imported"}
                      {menuParseResult.errors.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-muted-foreground">
                          {menuParseResult.errors.slice(0, 3).map((e, i) => <li key={i}>• {e}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Order Upload */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload className="h-4 w-4 text-accent" />
                    <h3 className="text-sm font-semibold">Upload Order History</h3>
                    <span className="text-[10px] text-muted-foreground">(Optional)</span>
                    {orderParseResult && orderParseResult.count > 0 && <CheckCircle2 className="ml-auto h-4 w-4 text-success" />}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Columns: Order ID, Item Name, Quantity, Timestamp</p>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleFileDrop(e, "order")}
                    className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-8 transition-colors hover:border-primary/40"
                  >
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">{orderFile ? orderFile.name : "Drag & drop your order CSV here"}</p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFileSelect(e, "order")} className="absolute inset-0 cursor-pointer opacity-0" />
                  </div>

                  {orderParseResult && (
                    <div className={`mt-3 rounded-lg p-3 text-xs ${orderParseResult.count > 0 ? "bg-success/5 text-success" : "bg-destructive/5 text-destructive"}`}>
                      {orderParseResult.count > 0 ? `✓ ${orderParseResult.count} orders imported` : "✗ No orders imported"}
                      {orderParseResult.unmatched.length > 0 && (
                        <div className="mt-1.5 flex items-start gap-1 text-muted-foreground">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-accent" />
                          <span>Unmatched items: {orderParseResult.unmatched.join(", ")}. These items were not found in the menu.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* NO PATH — Manual Entry (Enhanced) */}
            {usesPOS === false && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-5">
                <div className="insight-card">
                  <div className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" /><span className="text-xs font-semibold text-accent">No POS? No problem.</span></div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Add your menu items and sales data right here. You can also upload an Excel/CSV file and our AI will auto-detect menu and order data.</p>
                </div>

                {/* ── Inline Add Menu Item ── */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <PlusCircle className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Add Menu Items</h3>
                    {menuItems.length > 0 && <span className="ml-auto rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success">{menuItems.length} added</span>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Item Name *</label>
                      <input id="setup-item-name" type="text" value={manualItem.name} onChange={(e) => { setManualItem({ ...manualItem, name: e.target.value }); if (e.target.value.trim()) setManualItemErrors(p => ({ ...p, name: "" })); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("setup-item-price")?.focus(); } }}
                        placeholder="e.g. Butter Chicken" className={`mt-1 w-full rounded-xl border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${manualItemErrors.name ? 'border-destructive' : 'border-border'}`} />
                      {manualItemErrors.name && <p className="mt-0.5 text-[10px] text-destructive">{manualItemErrors.name}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Price (₹) *</label>
                      <input id="setup-item-price" type="number" min="1" value={manualItem.price} onChange={(e) => { setManualItem({ ...manualItem, price: e.target.value }); if (Number(e.target.value) > 0) setManualItemErrors(p => ({ ...p, price: "" })); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("setup-item-cost")?.focus(); } }}
                        placeholder="280" className={`mt-1 w-full rounded-xl border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${manualItemErrors.price ? 'border-destructive' : 'border-border'}`} />
                      {manualItemErrors.price && <p className="mt-0.5 text-[10px] text-destructive">{manualItemErrors.price}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Food Cost (₹) *</label>
                      <input id="setup-item-cost" type="number" min="0" value={manualItem.cost} onChange={(e) => { setManualItem({ ...manualItem, cost: e.target.value }); if (Number(e.target.value) >= 0) setManualItemErrors(p => ({ ...p, cost: "" })); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("setup-item-cat")?.focus(); } }}
                        placeholder="100" className={`mt-1 w-full rounded-xl border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${manualItemErrors.cost ? 'border-destructive' : 'border-border'}`} />
                      {manualItemErrors.cost && <p className="mt-0.5 text-[10px] text-destructive">{manualItemErrors.cost}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Category *</label>
                      <select id="setup-item-cat" value={manualItem.category} onChange={(e) => { setManualItem({ ...manualItem, category: e.target.value }); if (e.target.value) setManualItemErrors(p => ({ ...p, category: "" })); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); /* submit */ const btn = document.getElementById("setup-add-item-btn"); if (btn) btn.click(); } }}
                        className={`mt-1 w-full appearance-none rounded-xl border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${manualItemErrors.category ? 'border-destructive' : 'border-border'}`}>
                        <option value="">Select</option>
                        {setupCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {manualItemErrors.category && <p className="mt-0.5 text-[10px] text-destructive">{manualItemErrors.category}</p>}
                    </div>
                  </div>
                  <button id="setup-add-item-btn" onClick={() => {
                    const errs: Record<string, string> = {};
                    if (!manualItem.name.trim()) errs.name = "Required";
                    const p = Number(manualItem.price), c = Number(manualItem.cost);
                    if (!manualItem.price || p <= 0) errs.price = "Required";
                    if (!manualItem.cost && manualItem.cost !== "0") errs.cost = "Required";
                    if (c >= p && p > 0) errs.cost = "Must be < price";
                    if (!manualItem.category) errs.category = "Required";
                    if (Object.values(errs).some(Boolean)) { setManualItemErrors(errs); return; }
                    setManualItemErrors({});
                    addMenuItem({ name: manualItem.name.trim(), price: p, cost: c, category: manualItem.category });
                    toast.success(`${manualItem.name.trim()} added!`);
                    setManualItem({ name: "", price: "", cost: "", category: "" });
                    document.getElementById("setup-item-name")?.focus();
                  }} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 transition-all">
                    <PlusCircle className="h-3.5 w-3.5" /> Add Item
                  </button>

                  {/* Mini table of added items */}
                  {menuItems.length > 0 && (
                    <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-border/50">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary/50 sticky top-0"><tr className="text-muted-foreground"><th className="px-3 py-1.5 text-left font-medium">Name</th><th className="px-3 py-1.5 text-right font-medium">Price</th><th className="px-3 py-1.5 text-right font-medium">Cost</th><th className="px-3 py-1.5 text-left font-medium">Category</th><th className="px-2 py-1.5 w-8"></th></tr></thead>
                        <tbody className="divide-y divide-border/20">
                          {menuItems.map((item) => (
                            <tr key={item.id} className="hover:bg-secondary/20 group">
                              <td className="px-3 py-1.5 font-medium">{item.name}</td>
                              <td className="px-3 py-1.5 text-right">₹{item.price}</td>
                              <td className="px-3 py-1.5 text-right text-muted-foreground">₹{item.cost}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{item.category}</td>
                              <td className="px-2 py-1.5">
                                <button onClick={() => { removeMenuItem(item.id); toast.success(`${item.name} removed`); }} className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete item">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── Add Sales / Order Data ── */}
                {menuItems.length > 0 && (
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingCart className="h-4 w-4 text-accent" />
                      <h3 className="text-sm font-semibold">Add Sales Data</h3>
                      {orders.length > 0 && <span className="ml-auto rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent">{orders.length} orders</span>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Menu Item</label>
                        <select value={manualOrder.itemId} onChange={(e) => setManualOrder({ ...manualOrder, itemId: e.target.value })} className="mt-1 w-full appearance-none rounded-xl border border-border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                          <option value="">Select item</option>
                          {menuItems.map((item) => <option key={item.id} value={item.id}>{item.name} — ₹{item.price}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quantity</label>
                        <input type="number" min="1" value={manualOrder.qty} onChange={(e) => setManualOrder({ ...manualOrder, qty: e.target.value })} className="mt-1 w-full rounded-xl border border-border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Channel</label>
                        <select value={manualOrder.channel} onChange={(e) => setManualOrder({ ...manualOrder, channel: e.target.value })} className="mt-1 w-full appearance-none rounded-xl border border-border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                          <option value="OFFLINE">Offline / Dine-in</option>
                          <option value="ZOMATO">Zomato</option>
                          <option value="SWIGGY">Swiggy</option>
                          <option value="OTHER">Other Online</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={() => {
                      if (!manualOrder.itemId) { toast.error("Select a menu item"); return; }
                      const item = menuItems.find(m => m.id === Number(manualOrder.itemId));
                      if (!item) return;
                      const qty = Math.max(1, Number(manualOrder.qty) || 1);
                      addOrder(
                        [{ menuItemId: item.id, name: item.name, price: item.price, cost: item.cost, qty }],
                        manualOrder.channel as any
                      );
                      toast.success(`Order added: ${qty}x ${item.name}`);
                      setManualOrder({ itemId: "", qty: "1", channel: "OFFLINE" });
                    }} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:brightness-110 transition-all">
                      <ShoppingCart className="h-3.5 w-3.5" /> Record Sale
                    </button>
                  </div>
                )}

                {/* ── Or Upload Excel ── */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Or upload Excel / CSV</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Upload a file with menu items or sales data. AI will auto-detect the format and import accordingly.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleFileDrop(e, "menu")}
                      className="relative flex flex-col items-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-4 transition-colors hover:border-primary/40"
                    >
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                      <p className="mt-1 text-[11px] font-medium text-center">{menuFile ? menuFile.name : "Menu Data"}</p>
                      <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFileSelect(e, "menu")} className="absolute inset-0 cursor-pointer opacity-0" />
                    </div>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleFileDrop(e, "order")}
                      className="relative flex flex-col items-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-4 transition-colors hover:border-primary/40"
                    >
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                      <p className="mt-1 text-[11px] font-medium text-center">{orderFile ? orderFile.name : "Order Data"}</p>
                      <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFileSelect(e, "order")} className="absolute inset-0 cursor-pointer opacity-0" />
                    </div>
                  </div>
                  {menuParseResult && menuParseResult.count > 0 && <p className="mt-2 text-xs text-success">✓ {menuParseResult.count} menu items extracted</p>}
                  {orderParseResult && orderParseResult.count > 0 && <p className="mt-1 text-xs text-success">✓ {orderParseResult.count} orders extracted</p>}
                </div>
              </motion.div>
            )}

            {/* Navigation */}
            {usesPOS !== null && (
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary">Back</button>
                <button onClick={() => {
                  if (menuItems.length === 0) {
                    toast.error("Add at least one menu item", { description: "You need menu items before the AI engine can analyze your data." });
                    return;
                  }
                  setStep(3);
                }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110">
                  Activate AI Engine <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Step 3: Sync / Activation ─── */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-8 space-y-6">
            {!syncing && !syncDone && (
              <div className="glass-card p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Terminal className="h-8 w-8 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold">Ready to Activate</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {menuItems.length} menu items · AI engine will analyze your data.
                </p>
                <button onClick={startSync} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 glow-ring">
                  <Terminal className="h-4 w-4" /> Activate AI Engine
                </button>
              </div>
            )}

            {(syncing || syncDone) && (
              <div className="glass-card overflow-hidden">
                <div className="relative h-1.5 w-full bg-secondary overflow-hidden">
                  <motion.div className="absolute left-0 top-0 h-full rounded-r-full" style={{ background: "var(--gradient-primary)" }} initial={{ width: "0%" }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
                </div>
                <div ref={terminalRef} className="h-72 overflow-y-auto bg-[#0d1117] p-5 font-mono text-xs leading-relaxed">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-2 text-[10px] text-gray-500">revenucopilot — ai-engine</span>
                  </div>
                  {visibleLogs.map((log, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      className={`py-0.5 ${log.includes("✅") || log.includes("✓") ? "text-emerald-400" : log.includes("→") ? "text-blue-400" : log.includes("...") ? "text-cyan-400" : "text-gray-400"}`}>
                      <span className="text-gray-600 mr-2">$</span>{log}
                    </motion.div>
                  ))}
                  {syncing && !syncDone && <span className="inline-block h-3.5 w-1.5 animate-pulse bg-emerald-400" />}
                </div>
              </div>
            )}

            {syncDone && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <h2 className="font-display text-lg font-bold">You're All Set!</h2>
                <p className="mt-1 text-sm text-muted-foreground">{menuItems.length} menu items loaded. AI Revenue Copilot is ready.</p>
                <a href="/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 glow-ring">
                  Go to Command Center <ArrowRight className="h-4 w-4" />
                </a>
              </motion.div>
            )}

            {(syncing || syncDone) && (
              <button onClick={() => { setStep(2); setSyncing(false); setSyncDone(false); }} className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary">Back</button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default RestaurantSetup;
