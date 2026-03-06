import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Globe, PlusCircle, Trash2, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRestaurantData } from "@/lib/restaurantData";

const PlatformSettings = () => {
  const { commissions, updateCommission, addCommission, removeCommission } = useRestaurantData();
  const [newPlatform, setNewPlatform] = useState({ label: "", commission: "" });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editPct, setEditPct] = useState("");

  const builtIn = ["Offline / Dine-in", "Zomato", "Swiggy", "Other Online"];

  const handleAdd = async () => {
    const label = newPlatform.label.trim();
    const pct = Number(newPlatform.commission);
    if (!label) { toast.error("Enter a platform name"); return; }
    if (pct < 0 || pct > 100 || !newPlatform.commission) { toast.error("Enter a valid commission (0-100%)"); return; }
    if (commissions.find(c => c.label.toLowerCase() === label.toLowerCase())) { toast.error("Platform already exists"); return; }
    await addCommission(label, pct);
    setNewPlatform({ label: "", commission: "" });
    toast.success(`${label} added as online platform!`);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <Globe className="h-6 w-6 text-primary" />
            <div>
              <h1 className="font-display text-2xl font-bold">Platform Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage your online delivery platforms and commission rates.</p>
            </div>
          </div>

          {/* Current Platforms */}
          <div className="space-y-3">
            {commissions.map((c, idx) => {
              const isBuiltIn = builtIn.includes(c.label);
              const isEditing = editingIdx === idx;
              return (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card p-4"
                >
                  <div className="flex items-center gap-3">
                    {/* Toggle */}
                    <button onClick={async () => {
                      await updateCommission(c.channel, { enabled: !c.enabled });
                      toast.success(`${c.label} ${c.enabled ? "disabled" : "enabled"}`);
                    }} className="shrink-0">
                      {c.enabled
                        ? <ToggleRight className="h-6 w-6 text-primary" />
                        : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                    </button>

                    {/* Name */}
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${c.enabled ? "text-foreground" : "text-muted-foreground"}`}>{c.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.channel === "OFFLINE" ? "Walk-in / Dine-in" : `Channel: ${c.channel}`}
                        {!isBuiltIn && " • Custom Platform"}
                      </p>
                    </div>

                    {/* Commission */}
                    {c.channel !== "OFFLINE" && (
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <input
                              type="number" min="0" max="100" step="0.5"
                              value={editPct}
                              onChange={(e) => setEditPct(e.target.value)}
                              className="w-16 rounded-lg border border-border bg-card py-1 px-2 text-sm font-semibold text-center outline-none focus:ring-1 focus:ring-primary/20"
                              autoFocus
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                            <button onClick={async () => {
                              const pct = Number(editPct);
                              if (pct < 0 || pct > 100) { toast.error("0-100% only"); return; }
                              await updateCommission(c.channel, { commissionPct: pct });
                              setEditingIdx(null);
                              toast.success(`${c.label} commission updated to ${pct}%`);
                            }} className="p-1 rounded-md text-success hover:bg-success/10 transition-all">
                              <Save className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditingIdx(idx); setEditPct(String(c.commissionPct)); }}
                            className="rounded-lg bg-secondary/50 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary transition-all"
                          >
                            {c.commissionPct}% commission
                          </button>
                        )}
                      </div>
                    )}

                    {/* Delete (custom only) */}
                    {!isBuiltIn && (
                      <button onClick={async () => {
                        await removeCommission(c.label);
                        toast.success(`${c.label} removed`);
                      }} className="p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Add New Platform */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-5 mt-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <PlusCircle className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Add Online Platform</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Add a custom delivery or ordering platform (e.g., EatSure, Dunzo, your own website).</p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Platform Name</label>
                <input
                  type="text"
                  value={newPlatform.label}
                  onChange={(e) => setNewPlatform({ ...newPlatform, label: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("plat-comm")?.focus(); } }}
                  placeholder="e.g. EatSure, Dunzo, Website"
                  className="mt-1 w-full rounded-xl border border-border bg-card py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="w-28">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Commission %</label>
                <input
                  id="plat-comm"
                  type="number" min="0" max="100" step="0.5"
                  value={newPlatform.commission}
                  onChange={(e) => setNewPlatform({ ...newPlatform, commission: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  placeholder="e.g. 20"
                  className="mt-1 w-full rounded-xl border border-border bg-card py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all"
              >
                <PlusCircle className="h-4 w-4" /> Add
              </button>
            </div>
          </motion.div>

          {/* Info card */}
          <div className="mt-6 rounded-xl border border-border/40 bg-secondary/20 p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">How it works:</strong> Commissions reduce your effective profit margin on online orders.
              The AI engine uses these rates to calculate true profitability and recommend prices factoring in platform commissions.
              You can toggle platforms on/off, change commission rates, or add new custom platforms anytime.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PlatformSettings;
