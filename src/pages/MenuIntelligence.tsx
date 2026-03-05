import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Shield,
  Activity,
  Globe
} from "lucide-react";
import { useState, useMemo } from "react";
import { useRestaurantData } from "@/lib/restaurantData";
import {
  calculateMargin,
  calculateOnlineMargin,
  getOrderCountForItem,
  generatePriceRecommendations,
} from "@/lib/aiEngine";

const tagLabel: Record<string, string> = {
  "top-seller": "Top Seller",
  "hidden-star": "Hidden Star",
  "low-margin": "Low Margin Risk",
  "new": "New Item",
};

const tagClass: Record<string, string> = {
  "top-seller": "tag-top-seller",
  "hidden-star": "tag-hidden-star",
  "low-margin": "tag-low-margin",
  "new": "tag-new-item",
};

const categoryOptions = ["Main Course", "Starters", "Beverages", "Desserts", "Fast Food", "South Indian", "Snacks", "Breads"];

const impactBadge = (level: string) => {
  const cls = level === "HIGH" ? "bg-destructive/10 text-destructive" : level === "MEDIUM" ? "bg-accent/10 text-accent" : "bg-secondary text-muted-foreground";
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cls}`}>{level}</span>;
};

const MenuIntelligence = () => {
  const { menuItems, orders, commissions, addMenuItem } = useRestaurantData();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [expandedPriceRec, setExpandedPriceRec] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [newItem, setNewItem] = useState({ name: "", price: "", cost: "", category: "" });

  const priceRecs = useMemo(() => generatePriceRecommendations(menuItems, orders, commissions), [menuItems, orders, commissions]);

  const avgCommission = useMemo(() => {
    const active = commissions.filter(c => c.channel !== "OFFLINE" && c.enabled);
    return active.length ? active.reduce((s, c) => s + c.commissionPct, 0) / active.length : 22;
  }, [commissions]);

  const classifiedItems = useMemo(() => {
    const avgOrders = menuItems.reduce((s, m) => s + getOrderCountForItem(m.id, orders), 0) / (menuItems.length || 1);
    return menuItems.map((item) => {
      const margin = calculateMargin(item);
      const onlineMargin = calculateOnlineMargin(item, avgCommission);
      const orderCount = getOrderCountForItem(item.id, orders);
      let tag = "top-seller";
      if (margin > 55 && orderCount < avgOrders * 0.6) tag = "hidden-star";
      else if (margin < 40) tag = "low-margin";
      else if (orderCount === 0) tag = "new";
      const rec = priceRecs.find((r) => r.menuItem.id === item.id);
      return { ...item, margin, onlineMargin, orderCount, tag, recommendation: rec?.reason || "AI will generate insights after more orders.", priceRec: rec };
    });
  }, [menuItems, orders, priceRecs, avgCommission]);

  const handleAddItem = () => {
    const price = Number(newItem.price);
    const cost = Number(newItem.cost);
    if (!newItem.name || !price || !cost) return;
    addMenuItem({ name: newItem.name, price, cost, category: newItem.category || "Other" });
    setNewItem({ name: "", price: "", cost: "", category: "" });
    setShowAddForm(false);
  };

  const filteredItems = classifiedItems
    .filter((item) => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Top Seller") return item.tag === "top-seller";
      if (activeFilter === "Hidden Star") return item.tag === "hidden-star";
      if (activeFilter === "Low Margin") return item.tag === "low-margin";
      if (activeFilter === "New") return item.tag === "new";
      return true;
    })
    .filter((item) => searchQuery ? item.name.toLowerCase().includes(searchQuery.toLowerCase()) : true);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold">Menu Intelligence</h1>
              <p className="mt-1 text-sm text-muted-foreground">AI-powered analysis of {menuItems.length} items across {orders.length} orders.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowPricing(!showPricing); setShowAddForm(false); }} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${showPricing ? "bg-accent text-accent-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}>
                <TrendingUp className="h-4 w-4" />{showPricing ? "Hide Pricing" : "Price Optimization"}
              </button>
              <button onClick={() => { setShowAddForm(!showAddForm); setShowPricing(false); }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
                {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showAddForm ? "Cancel" : "Add Item"}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Add Item Form */}
        {showAddForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-6 glass-card p-5">
            <div className="flex items-center gap-2 mb-4"><Plus className="h-4 w-4 text-primary" /><h3 className="font-display text-sm font-semibold">Add New Menu Item</h3></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="text-xs font-medium text-muted-foreground">Item Name</label><input type="text" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Paneer Butter Masala" className="mt-1.5 w-full rounded-xl border border-border bg-card py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Selling Price (₹)</label><input type="number" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} placeholder="e.g. 280" className="mt-1.5 w-full rounded-xl border border-border bg-card py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Food Cost (₹)</label><input type="number" value={newItem.cost} onChange={(e) => setNewItem({ ...newItem, cost: e.target.value })} placeholder="e.g. 100" className="mt-1.5 w-full rounded-xl border border-border bg-card py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Category</label><select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} className="mt-1.5 w-full appearance-none rounded-xl border border-border bg-card py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"><option value="">Select category</option>{categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            {newItem.price && newItem.cost && Number(newItem.price) > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">Estimated margin: <span className={`font-semibold ${((Number(newItem.price) - Number(newItem.cost)) / Number(newItem.price)) * 100 > 50 ? "text-success" : "text-destructive"}`}>{(((Number(newItem.price) - Number(newItem.cost)) / Number(newItem.price)) * 100).toFixed(1)}%</span></div>
            )}
            <button onClick={handleAddItem} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"><Plus className="h-3.5 w-3.5" /> Add to Menu</button>
          </motion.div>
        )}

        {/* Price Optimization Panel */}
        {showPricing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-6 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <h3 className="font-display text-sm font-semibold">AI Price Optimization</h3>
              <span className="text-xs text-muted-foreground">Based on {orders.length} order analysis</span>
            </div>
            {priceRecs.filter((r) => r.suggestedPrice !== r.currentPrice || (r.suggestedOnlinePrice && r.suggestedOnlinePrice !== r.currentPrice)).slice(0, 6).map((rec, i) => (
              <motion.div key={rec.menuItem.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold">{rec.menuItem.name}</h4>
                      {impactBadge(rec.impactLevel)}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${rec.demandLevel === "high" ? "bg-success/10 text-success" : rec.demandLevel === "low" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>{rec.demandLevel} demand</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${rec.marginLevel === "high" ? "bg-success/10 text-success" : rec.marginLevel === "low" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>{rec.marginLevel} margin</span>
                      <div className="flex items-center gap-1"><Shield className="h-2.5 w-2.5 text-muted-foreground" /><span className={`text-[10px] font-bold ${rec.confidence >= 75 ? "text-success" : rec.confidence >= 50 ? "text-accent" : "text-muted-foreground"}`}>{rec.confidence}%</span></div>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{rec.reason}</p>
                  </div>
                  <div className="ml-4 shrink-0 mt-1">
                    <div className="flex flex-col items-end gap-2">
                      {rec.suggestedPrice !== rec.currentPrice && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Offline</span>
                          <span className="text-sm text-muted-foreground line-through">₹{rec.currentPrice}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-display text-lg font-bold text-primary">₹{rec.suggestedPrice}</span>
                        </div>
                      )}
                      {rec.suggestedOnlinePrice && rec.suggestedOnlinePrice !== rec.currentPrice && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-3 w-3 text-accent" />
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Online</span>
                          <span className="text-sm text-muted-foreground line-through">₹{rec.currentPrice}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-display text-lg font-bold text-accent">₹{rec.suggestedOnlinePrice}</span>
                        </div>
                      )}

                      <div className="mt-1 flex items-center justify-end gap-1">
                        {rec.estimatedRevenueChange >= 0 ? <TrendingUp className="h-3 w-3 text-success" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
                        <span className={`text-xs font-bold ${rec.estimatedRevenueChange >= 0 ? "text-success" : "text-destructive"}`}>{rec.estimatedRevenueChange > 0 ? "+" : ""}{rec.estimatedRevenueChange}% revenue</span>
                      </div>
                      {rec.estimatedMonthlyImpact > 0 && <p className="text-[10px] font-semibold text-success">+₹{rec.estimatedMonthlyImpact}/mo</p>}
                    </div>
                  </div>
                </div>

                {/* Expandable reasoning */}
                <button onClick={() => setExpandedPriceRec(expandedPriceRec === i ? null : i)} className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  {expandedPriceRec === i ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  AI Reasoning
                </button>
                {expandedPriceRec === i && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 rounded-xl border border-border/30 bg-secondary/20 p-3">
                    <ul className="space-y-1">
                      {rec.reasoning.map((r, ri) => (
                        <li key={ri} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                          <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />{r}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {rec.impactedMetrics.map((m) => <span key={m} className="rounded-full bg-primary/5 px-2 py-0.5 text-[9px] font-medium text-primary">{m}</span>)}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Filters */}
        <div className="mt-6 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search items..." className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex gap-2">
            {["All", "Top Seller", "Hidden Star", "Low Margin", "New"].map((f) => (
              <button key={f} onClick={() => setActiveFilter(f)} className={activeFilter === f ? "nav-pill-active" : "nav-pill-inactive"}>{f}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-6 glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-5 py-3">Item Name</th>
                <th className="px-5 py-3">Selling Price</th>
                <th className="px-5 py-3">Food Cost</th>
                <th className="px-5 py-3 truncate">Profit Margin<br /><span className="text-[10px] font-normal text-muted-foreground">(Offline | Online)</span></th>
                <th className="px-5 py-3">Orders</th>
                <th className="px-5 py-3">Performance</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, i) => (
                <optgroup key={item.id} className="contents">
                  <tr onClick={() => setExpanded(expanded === i ? null : i)} className="cursor-pointer border-b border-border/30 transition-colors hover:bg-secondary/30">
                    <td className="px-5 py-3.5 text-sm font-medium">{item.name}</td>
                    <td className="px-5 py-3.5 text-sm">₹{item.price}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">₹{item.cost}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <span className={item.margin > 50 ? "text-success" : "text-destructive"}>{item.margin.toFixed(0)}%</span>
                        <span className="text-muted-foreground/30">|</span>
                        <span className={`text-xs ${item.onlineMargin > 50 ? "text-success/70" : "text-destructive/70"}`}>{item.onlineMargin.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm">{item.orderCount}</td>
                    <td className="px-5 py-3.5"><span className={tagClass[item.tag]}>{tagLabel[item.tag]}</span></td>
                    <td className="px-5 py-3.5">{expanded === i ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                  </tr>
                  {expanded === i && (
                    <tr>
                      <td colSpan={7} className="bg-primary/[0.03] px-5 py-4 border-b border-border/30">
                        <div className="flex items-start gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs font-semibold text-accent">AI Recommendation</p>
                              {item.priceRec && (
                                <>
                                  {impactBadge(item.priceRec.impactLevel)}
                                  <div className="flex items-center gap-1"><Shield className="h-2.5 w-2.5 text-muted-foreground" /><span className={`text-[10px] font-bold ${item.priceRec.confidence >= 75 ? "text-success" : item.priceRec.confidence >= 50 ? "text-accent" : "text-muted-foreground"}`}>{item.priceRec.confidence}% confidence</span></div>
                                </>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{item.recommendation}</p>
                            {item.priceRec && (item.priceRec.suggestedPrice !== item.priceRec.currentPrice || (item.priceRec.suggestedOnlinePrice && item.priceRec.suggestedOnlinePrice !== item.priceRec.currentPrice)) && (
                              <div className="mt-3 flex items-center gap-3 flex-wrap">
                                {item.priceRec.suggestedPrice !== item.priceRec.currentPrice && (
                                  <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
                                    <span className="text-xs text-muted-foreground">Suggested Offline:</span>
                                    <span className="text-xs line-through text-muted-foreground">₹{item.priceRec.currentPrice}</span>
                                    <ArrowRight className="h-3 w-3 text-primary" />
                                    <span className="text-xs font-bold text-primary">₹{item.priceRec.suggestedPrice}</span>
                                  </div>
                                )}
                                {item.priceRec.suggestedOnlinePrice && item.priceRec.suggestedOnlinePrice !== item.priceRec.currentPrice && (
                                  <div className="inline-flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5">
                                    <Globe className="h-3 w-3 text-accent" />
                                    <span className="text-xs text-muted-foreground">Online Price:</span>
                                    <span className="text-xs line-through text-muted-foreground">₹{item.priceRec.currentPrice}</span>
                                    <ArrowRight className="h-3 w-3 text-accent" />
                                    <span className="text-xs font-bold text-accent">₹{item.priceRec.suggestedOnlinePrice}</span>
                                  </div>
                                )}
                                {item.priceRec.estimatedMonthlyImpact > 0 && (
                                  <span className="text-xs font-semibold text-success">+₹{item.priceRec.estimatedMonthlyImpact}/mo</span>
                                )}
                              </div>
                            )}
                            {item.priceRec && item.priceRec.impactedMetrics.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {item.priceRec.impactedMetrics.map((m) => <span key={m} className="rounded-full bg-primary/5 px-2 py-0.5 text-[9px] font-medium text-primary">{m}</span>)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </optgroup>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </div>
  );
};

export default MenuIntelligence;
