import { Link, useLocation } from "react-router-dom";
import { BarChart3, Brain, Mic, Utensils, Layers, FileText, Home, Settings, ShoppingCart, PackageOpen, LayoutDashboard } from "lucide-react";
import { useRestaurantData } from "@/lib/restaurantData";

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Setup", path: "/setup", icon: Settings },
  { label: "Command Center", path: "/dashboard", icon: LayoutDashboard },
  { label: "Menu Intelligence", path: "/menu", icon: Utensils },
  { label: "POS Simulator", path: "/pos", icon: ShoppingCart },
  { label: "Order Logs", path: "/orders", icon: PackageOpen },
  { label: "Combo Engine", path: "/combos", icon: Layers },
  { label: "Voice Copilot", path: "/voice", icon: Mic },
  { label: "Insights", path: "/insights", icon: FileText },
];

export function DashboardNav() {
  const location = useLocation();
  const { profile } = useRestaurantData();

  // Filter out the Setup menu item if the user has already completed the setup
  const visibleNavItems = navItems.filter(item => {
    if (item.path === '/setup' && profile.setupComplete) return false;
    return true;
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/10 bg-background/80 backdrop-blur-xl shadow-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            Revenue<span className="text-primary">Copilot</span>
          </span>
        </Link>

        <nav className="hidden xl:flex items-center gap-1 overflow-x-auto no-scrollbar mask-edges">
          {visibleNavItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={active ? "nav-pill-active font-semibold shadow-sm" : "nav-pill-inactive"}
              >
                <item.icon className="mr-1.5 inline h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {/* Restaurant Name Badge */}
          {profile.name ? (
            <div className="flex items-center gap-2 rounded-full border border-border/50 bg-secondary/30 pl-3 pr-1 py-1">
              <span className="text-xs font-semibold text-foreground/80 hidden sm:inline-block">
                {profile.name}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-accent/10 px-3 py-1 text-[10px] font-bold text-accent uppercase tracking-wider hidden sm:inline-block">
                Demo Mode
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">
                D
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
