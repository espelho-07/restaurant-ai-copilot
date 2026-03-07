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
import { POS_DEFAULTS, testPOSConnection, fetchMenuFromPOS, fetchOrdersFromPOS } from "@/lib/posService";
import type { POSConnectionResult, POSType } from "@/lib/posService";
import { toast } from "sonner";

const cuisineTypes = [
  "North Indian", "South Indian", "Chinese", "Italian",
  "Multi-Cuisine", "Fast Food", "Cafe & Bakery", "Street Food",
];

const RestaurantSetup = () => {
  const { menuItems, orders, importMenuItems, importOrders, addMenuItem, removeMenuItem, addOrder, updateProfile, profile, commissions, updateCommission, addCommission, removeCommission, updatePOSConfig } = useRestaurantData();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile.setupComplete) {
      navigate('/dashboard');
    }
  }, [profile.setupComplete, navigate]);

  const [step, setStep] = useState(1);
  const [usesPOS, setUsesPOS] = useState<boolean | null>(null);

  // POS API integration state
  const [selectedPOS, setSelectedPOS] = useState<POSType | null>(null);
  const [posForm, setPosForm] = useState({ apiBaseUrl: "", apiKey: "", restaurantId: "", secretKey: "", autoSync: false, syncInterval: 5 });
  const [posConnecting, setPosConnecting] = useState(false);
  const [posConnectionResult, setPosConnectionResult] = useState<POSConnectionResult | null>(null);
  const [menuSyncing, setMenuSyncing] = useState(false);
  const [menuSyncDone, setMenuSyncDone] = useState(false);
  const [orderSyncing, setOrderSyncing] = useState(false);
  const [orderSyncDone, setOrderSyncDone] = useState(false);

  // Sync animation
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Custom Platform State
  const [customPlatformName, setCustomPlatformName] = useState("");
  const [customPlatformComm, setCustomPlatformComm] = useState("");

  // File upload state
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [menuParseResult, setMenuParseResult] = useState<{ count: number; errors: string[] } | null>(null);
  const [orderParseResult, setOrderParseResult] = useState<{ count: number; errors: string[]; unmatched: string[] } | null>(null);
  const [menuImportProgress, setMenuImportProgress] = useState(0);
  const [orderImportProgress, setOrderImportProgress] = useState(0);
  const [menuImporting, setMenuImporting] = useState(false);
  const [orderImporting, setOrderImporting] = useState(false);
  const isImporting = menuImporting || orderImporting;

  const [form, setForm] = useState({
    name: profile.name || "",
    location: profile.location || "",
    cuisine: profile.cuisine || "",
  });
  const [formErrors, setFormErrors] = useState<{ name?: string; location?: string; cuisine?: string }>({});

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
    const errors: { name?: string; location?: string; cuisine?: string } = {};
    if (!form.name.trim()) errors.name = "Restaurant name is required.";
    if (!form.location.trim()) errors.location = "Location is required.";
    if (!form.cuisine.trim()) errors.cuisine = "Please select a cuisine type.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── FILE HANDLERS ──────────────────────────────────────────────

  // POS connection handlers
  const handleTestConnection = async () => {
    if (!selectedPOS || selectedPOS === "none") return;
    setPosConnecting(true);
    setPosConnectionResult(null);
    try {
      const result = await testPOSConnection({
        posType: selectedPOS,
        apiBaseUrl: posForm.apiBaseUrl,
        apiKey: posForm.apiKey,
        restaurantId: posForm.restaurantId,
        secretKey: posForm.secretKey,
        autoSync: posForm.autoSync,
        syncIntervalMinutes: posForm.syncInterval,
        connected: false,
      });
      setPosConnectionResult(result);
      if (result.success) toast.success("POS Connected!");
      else toast.error(result.message);
    } catch (err) {
      setPosConnectionResult({ success: false, message: "Connection failed. Please check your credentials." });
      toast.error("Connection failed");
    } finally {
      setPosConnecting(false);
    }
  };

  const handleMenuSync = async () => {
    if (!selectedPOS || selectedPOS === "none") return;
    setMenuSyncing(true);
    try {
      const result = await fetchMenuFromPOS({
        posType: selectedPOS,
        apiBaseUrl: posForm.apiBaseUrl,
        apiKey: posForm.apiKey,
        restaurantId: posForm.restaurantId,
        secretKey: posForm.secretKey,
        autoSync: false,
        syncIntervalMinutes: 5,
        connected: true,
      });
      if (result.items.length > 0) {
        await importMenuItems(result.items);
        setMenuSyncDone(true);
        toast.success(`${result.items.length} menu items synced!`);
      } else {
        toast.error("No menu items found");
      }
    } catch { toast.error("Menu sync failed"); }
    finally { setMenuSyncing(false); }
  };

  const handleOrderSync = async () => {
    if (!selectedPOS || selectedPOS === "none") return;
    setOrderSyncing(true);
    try {
      const result = await fetchOrdersFromPOS({
        posType: selectedPOS,
        apiBaseUrl: posForm.apiBaseUrl,
        apiKey: posForm.apiKey,
        restaurantId: posForm.restaurantId,
        secretKey: posForm.secretKey,
        autoSync: false,
        syncIntervalMinutes: 5,
        connected: true,
      });
      if (result.orders.length > 0) {
        await importOrders(result.orders);
        setOrderSyncDone(true);
        toast.success(`${result.orders.length} orders synced!`);
      } else {
        toast.error("No orders found");
      }
    } catch { toast.error("Order sync failed"); }
    finally { setOrderSyncing(false); }
  };

  const handleMenuUpload = useCallback(async (file: File) => {
    if (isImporting) return;

    const validExts = [".csv", ".xlsx", ".xls"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) {
      toast.error("Invalid file format", { description: `Expected CSV or Excel file, got "${ext}". Please upload a .csv, .xlsx, or .xls file.` });
      return;
    }
    try {
      setMenuImporting(true);
      setMenuImportProgress(5);
      setMenuFile(file);
      const result = await parseMenuCSV(file);
      setMenuImportProgress(25);

      if (result.items.length === 0) {
        setMenuParseResult({ count: 0, errors: result.errors.length > 0 ? result.errors : ["No valid menu items found. Make sure your file has columns: Item Name, Selling Price, Food Cost, Category."] });
        toast.error("Could not parse menu file", { description: "Check that your file has the required columns." });
        return;
      }

      const { added, duplicates } = await importMenuItems(result.items, (percent) => {
        setMenuImportProgress(Math.max(25, percent));
      });
      setMenuImportProgress(100);
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
      setMenuImportProgress(0);
    } finally {
      setMenuImporting(false);
    }
  }, [importMenuItems, isImporting]);

  const handleOrderUpload = useCallback(async (file: File) => {
    if (isImporting) return;

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
      setOrderImporting(true);
      setOrderImportProgress(5);
      setOrderFile(file);
      const result = await parseOrderCSV(file, menuItems);
      setOrderImportProgress(25);

      if (result.orders.length === 0) {
        setOrderParseResult({
          count: 0,
          errors: result.errors.length > 0 ? result.errors : ["No valid orders found. Make sure item names match your menu."],
          unmatched: result.stats.unmatchedItems,
        });
        toast.error("Could not parse order file", { description: "Item names in the file didn't match any menu items." });
        return;
      }

      const count = await importOrders(result.orders, (percent) => {
        setOrderImportProgress(Math.max(25, percent));
      });
      setOrderImportProgress(100);
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
      setOrderImportProgress(0);
    } finally {
      setOrderImporting(false);
    }
  }, [menuItems, importOrders, isImporting]);

  const handleFileDrop = useCallback((e: React.DragEvent, type: "menu" | "order") => {
    e.preventDefault();
    if (isImporting) return;
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (type === "menu") handleMenuUpload(file);
    else handleOrderUpload(file);
  }, [handleMenuUpload, handleOrderUpload, isImporting]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: "menu" | "order") => {
    if (isImporting) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === "menu") handleMenuUpload(file);
    else handleOrderUpload(file);
  }, [handleMenuUpload, handleOrderUpload, isImporting]);
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
                  <select id="setup-cuisine" value={form.cuisine} onChange={(e) => { setForm({ ...form, cuisine: e.target.value }); if (e.target.value) setFormErrors(p => ({ ...p, cuisine: undefined })); }} className={`w-full appearance-none rounded-xl border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${formErrors.cuisine ? 'border-destructive focus:ring-destructive/20' : 'border-border'}`}>
                    <option value="">Select cuisine type *</option>
                    {cuisineTypes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {formErrors.cuisine && <p className="mt-1 text-[11px] text-destructive">{formErrors.cuisine}</p>}
              </div>
            </div>

            <div className="pt-2 border-t border-border/50 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-accent" />
                <h3 className="font-display text-sm font-semibold">Online Delivery Platforms</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Set your commission rates to get accurate online profitability insights.</p>
              <div className="space-y-3">
                {commissions.filter(c => c.channel !== "OFFLINE").map((c) => {
                  const builtIn = ["Offline / Dine-in", "Zomato", "Swiggy", "Other Online"];
                  const isCustom = !builtIn.includes(c.label);
                  return (
                    <div key={c.label} className="flex items-center justify-between rounded-xl border border-border bg-secondary/20 p-3">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={c.enabled} onChange={(e) => updateCommission(c.channel, { enabled: e.target.checked, label: c.label })} className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary" />
                        <span className="text-sm font-semibold">{c.label}</span>
                        {isCustom && <span className="text-[9px] rounded-full bg-accent/10 px-2 py-0.5 font-bold text-accent">Custom</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {c.enabled && (
                          <>
                            <span className="text-xs text-muted-foreground">Commission %</span>
                            <input type="number" value={c.commissionPct} onChange={(e) => updateCommission(c.channel, { commissionPct: Number(e.target.value), label: c.label })} className="w-16 rounded-lg border border-border bg-card py-1 px-2 text-sm font-semibold text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary/20" />
                          </>
                        )}
                        {isCustom && (
                          <button onClick={() => { removeCommission(c.label); toast.success(`${c.label} removed`); }} className="p-1 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all" title="Remove platform">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Custom Platform */}
              <div className="mt-4 flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Add Custom Platform</label>
                  <input type="text" id="setup-custom-platform" placeholder="e.g. EatSure, Dunzo" value={customPlatformName} onChange={(e) => setCustomPlatformName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="w-24">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Comm. %</label>
                  <input type="number" min="0" max="100" placeholder="20" value={customPlatformComm} onChange={(e) => setCustomPlatformComm(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <button onClick={() => {
                  const name = customPlatformName.trim();
                  const pct = Number(customPlatformComm);
                  if (!name) { toast.error("Enter platform name"); return; }
                  if (!customPlatformComm || pct < 0 || pct > 100) { toast.error("Valid commission 0-100%"); return; }
                  addCommission(name, pct);
                  setCustomPlatformName(""); setCustomPlatformComm("");
                  toast.success(`${name} added!`);
                }} className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:brightness-110 transition-all">+ Add</button>
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

            {/* POS Yes/No Toggle */}
            <div className="glass-card p-6">
              <h2 className="font-display text-sm font-semibold mb-4">Do you currently use a POS system?</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setUsesPOS(true); setSelectedPOS(null); }}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all ${usesPOS === true ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <FileSpreadsheet className={`h-8 w-8 ${usesPOS === true ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-semibold">Yes — I use a POS</span>
                  <span className="text-xs text-muted-foreground">Connect API or upload CSV</span>
                </button>
                <button
                  onClick={() => { setUsesPOS(false); setSelectedPOS("none"); }}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all ${usesPOS === false ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <PlusCircle className={`h-8 w-8 ${usesPOS === false ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-semibold">No — I don't use a POS</span>
                  <span className="text-xs text-muted-foreground">Add data manually or CSV</span>
                </button>
              </div>
            </div>

            {/* YES PATH — POS Selection + CSV */}
            {usesPOS === true && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
                {/* POS System Cards */}
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold mb-3">Select your POS system</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {([
                      { key: "petpooja", label: "Petpooja", icon: "🟠", desc: "Indian POS leader" },
                      { key: "posist", label: "POSist", icon: "🔵", desc: "Cloud-based POS" },
                      { key: "urbanpiper", label: "UrbanPiper", icon: "🟢", desc: "Aggregator hub" },
                      { key: "other", label: "Other POS", icon: "⚙️", desc: "Custom API" },
                    ] as const).map((pos) => (
                      <button key={pos.key}
                        onClick={() => {
                          setSelectedPOS(pos.key);
                          const defaults = POS_DEFAULTS[pos.key];
                          if (defaults) setPosForm(prev => ({ ...prev, apiBaseUrl: defaults.baseUrl }));
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-center transition-all ${selectedPOS === pos.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                      >
                        <span className="text-2xl">{pos.icon}</span>
                        <span className="text-xs font-semibold">{pos.label}</span>
                        <span className="text-[10px] text-muted-foreground">{pos.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* POS API Connection Form — inside Yes path */}
                {selectedPOS && selectedPOS !== "none" && (
                  <div className="space-y-4">
                    <div className="glass-card p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-lg">{POS_DEFAULTS[selectedPOS]?.icon || "⚙️"}</span>
                        <div>
                          <h3 className="text-sm font-semibold">Connect {POS_DEFAULTS[selectedPOS]?.label || "POS"}</h3>
                          <p className="text-[10px] text-muted-foreground">Connect your POS system to automatically sync menu and sales data.</p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">API Base URL *</label>
                          <input type="text" value={posForm.apiBaseUrl} onChange={(e) => setPosForm({ ...posForm, apiBaseUrl: e.target.value })}
                            placeholder="https://api.example.com/v1" className="mt-1 w-full rounded-xl border border-border bg-card py-2 px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">API Key / Token *</label>
                          <input type="password" value={posForm.apiKey} onChange={(e) => setPosForm({ ...posForm, apiKey: e.target.value })}
                            placeholder="Enter your API key" className="mt-1 w-full rounded-xl border border-border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        {(selectedPOS !== "urbanpiper") && (
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Restaurant ID {selectedPOS === "other" ? "" : "*"}</label>
                            <input type="text" value={posForm.restaurantId} onChange={(e) => setPosForm({ ...posForm, restaurantId: e.target.value })}
                              placeholder="e.g. REST-12345" className="mt-1 w-full rounded-xl border border-border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                        )}
                        {(selectedPOS === "posist" || selectedPOS === "urbanpiper") && (
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Secret Key *</label>
                            <input type="password" value={posForm.secretKey} onChange={(e) => setPosForm({ ...posForm, secretKey: e.target.value })}
                              placeholder="Enter secret key" className="mt-1 w-full rounded-xl border border-border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                        )}
                      </div>

                      {/* Connection Test */}
                      <div className="mt-5 flex items-center gap-3">
                        <button onClick={handleTestConnection} disabled={posConnecting}
                          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50">
                          {posConnecting ? (
                            <><span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Testing...</>
                          ) : (
                            <><Sparkles className="h-3.5 w-3.5" /> Test Connection</>
                          )}
                        </button>

                        {posConnectionResult && (
                          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex-1">
                            <div className={`flex items-start gap-2 rounded-lg p-3 text-xs ${posConnectionResult.success ? "bg-success/5 text-success" : "bg-destructive/5 text-destructive"}`}>
                              {posConnectionResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                              <div>
                                <p className="font-semibold">{posConnectionResult.message}</p>
                                {posConnectionResult.restaurantName && <p className="text-muted-foreground mt-0.5">Restaurant: {posConnectionResult.restaurantName}</p>}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Sync UI — shown after successful connection */}
                    {posConnectionResult?.success && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        {/* Menu Sync */}
                        <div className="glass-card p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <Upload className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-semibold">Menu Sync</h3>
                            {menuSyncDone && <CheckCircle2 className="ml-auto h-4 w-4 text-success" />}
                          </div>
                          {!menuSyncDone ? (
                            <button onClick={handleMenuSync} disabled={menuSyncing}
                              className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-secondary/80 disabled:opacity-50">
                              {menuSyncing ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" /> Fetching menu...</> : "Fetch Menu from POS"}
                            </button>
                          ) : (
                            <p className="text-xs text-success font-medium">✓ {menuItems.length} menu items synced successfully</p>
                          )}
                        </div>

                        {/* Order Sync */}
                        <div className="glass-card p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <ShoppingCart className="h-4 w-4 text-accent" />
                            <h3 className="text-sm font-semibold">Order History Sync</h3>
                            {orderSyncDone && <CheckCircle2 className="ml-auto h-4 w-4 text-success" />}
                          </div>
                          {!orderSyncDone ? (
                            <button onClick={handleOrderSync} disabled={orderSyncing || !menuSyncDone}
                              className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-secondary/80 disabled:opacity-50">
                              {orderSyncing ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" /> Fetching orders...</> : "Fetch Order History"}
                            </button>
                          ) : (
                            <p className="text-xs text-success font-medium">✓ {orders.length} orders synced successfully</p>
                          )}
                          {!menuSyncDone && <p className="text-[10px] text-muted-foreground mt-1">Sync menu first before importing orders.</p>}
                        </div>

                        {/* Auto-Sync Toggle */}
                        <div className="glass-card p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold">Enable Automatic POS Sync</h3>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Automatically fetch new orders every {posForm.syncInterval} minutes</p>
                            </div>
                            <button onClick={() => setPosForm(prev => ({ ...prev, autoSync: !prev.autoSync }))}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${posForm.autoSync ? "bg-primary" : "bg-border"}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${posForm.autoSync ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                          </div>
                          {posForm.autoSync && (
                            <div className="mt-3 flex items-center gap-2">
                              <label className="text-[10px] font-semibold text-muted-foreground">Sync interval (minutes):</label>
                              <input type="number" min="1" max="60" value={posForm.syncInterval} onChange={(e) => setPosForm({ ...posForm, syncInterval: Math.max(1, Number(e.target.value)) })}
                                className="w-16 rounded-lg border border-border bg-card py-1 px-2 text-sm font-semibold text-center outline-none focus:ring-1 focus:ring-primary/20" />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* CSV Upload — also available inside Yes path */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Or upload Excel / CSV</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Upload a file with menu items or sales data. AI will auto-detect the format.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleFileDrop(e, "menu")}
                      className={`relative flex flex-col items-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-4 transition-colors ${isImporting ? "cursor-not-allowed opacity-60" : "hover:border-primary/40"}` }
                    >
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                      <p className="mt-1 text-[11px] font-medium text-center">{menuFile ? menuFile.name : "Menu Data"}</p>
                      <input disabled={isImporting} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFileSelect(e, "menu")} className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" />
                    </div>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleFileDrop(e, "order")}
                      className={`relative flex flex-col items-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-4 transition-colors ${isImporting ? "cursor-not-allowed opacity-60" : "hover:border-primary/40"}` }
                    >
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                      <p className="mt-1 text-[11px] font-medium text-center">{orderFile ? orderFile.name : "Order Data"}</p>
                      <input disabled={isImporting} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFileSelect(e, "order")} className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" />
                    </div>
                  </div>
                  {menuImporting && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Menu import in progress: {menuImportProgress}%</p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${menuImportProgress}%` }} />
                      </div>
                    </div>
                  )}
                  {orderImporting && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Order import in progress: {orderImportProgress}%</p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${orderImportProgress}%` }} />
                      </div>
                    </div>
                  )}
                  {menuParseResult && menuParseResult.count > 0 && <p className="mt-2 text-xs text-success">{menuParseResult.count} menu items extracted</p>}
                  {orderParseResult && orderParseResult.count > 0 && <p className="mt-1 text-xs text-success">{orderParseResult.count} orders extracted</p>}
                </div>
              </motion.div>
            )}

            {/* NO POS PATH — CSV Upload + Manual Entry (existing flow, unchanged) */}
            {selectedPOS === "none" && (
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
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const btn = document.getElementById("setup-add-item-btn"); if (btn) btn.click(); } }}
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
                      className={`relative flex flex-col items-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-4 transition-colors ${isImporting ? "cursor-not-allowed opacity-60" : "hover:border-primary/40"}` }
                    >
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                      <p className="mt-1 text-[11px] font-medium text-center">{menuFile ? menuFile.name : "Menu Data"}</p>
                      <input disabled={isImporting} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFileSelect(e, "menu")} className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" />
                    </div>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleFileDrop(e, "order")}
                      className={`relative flex flex-col items-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-4 transition-colors ${isImporting ? "cursor-not-allowed opacity-60" : "hover:border-primary/40"}` }
                    >
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                      <p className="mt-1 text-[11px] font-medium text-center">{orderFile ? orderFile.name : "Order Data"}</p>
                      <input disabled={isImporting} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFileSelect(e, "order")} className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" />
                    </div>
                  </div>
                  {menuImporting && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Menu import in progress: {menuImportProgress}%</p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${menuImportProgress}%` }} />
                      </div>
                    </div>
                  )}
                  {orderImporting && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Order import in progress: {orderImportProgress}%</p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${orderImportProgress}%` }} />
                      </div>
                    </div>
                  )}
                  {menuParseResult && menuParseResult.count > 0 && <p className="mt-2 text-xs text-success">{menuParseResult.count} menu items extracted</p>}
                  {orderParseResult && orderParseResult.count > 0 && <p className="mt-1 text-xs text-success">{orderParseResult.count} orders extracted</p>}
                </div>
              </motion.div>
            )}

            {/* Navigation */}
            {selectedPOS !== null && (
              <div className="flex gap-3">
                <button
                  disabled={isImporting}
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  disabled={isImporting}
                  onClick={() => {
                    if (menuItems.length === 0) {
                      toast.error("Add at least one menu item", { description: "You need menu items before the AI engine can analyze your data." });
                      return;
                    }
                    // Save POS config if connected
                    if (selectedPOS && selectedPOS !== "none" && posConnectionResult?.success) {
                      updatePOSConfig({
                        posType: selectedPOS as any,
                        apiBaseUrl: posForm.apiBaseUrl,
                        apiKey: posForm.apiKey,
                        restaurantId: posForm.restaurantId,
                        secretKey: posForm.secretKey,
                        autoSync: posForm.autoSync,
                        syncIntervalMinutes: posForm.syncInterval,
                        connected: true,
                        lastSyncAt: new Date().toISOString(),
                      });
                    }
                    setStep(3);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImporting ? "Import in progress..." : "Activate AI Engine"} <ArrowRight className="h-4 w-4" />
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

