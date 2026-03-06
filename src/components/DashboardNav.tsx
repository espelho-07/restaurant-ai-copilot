import { Link, useLocation } from "react-router-dom";
import { Brain, Globe, Home, LayoutDashboard, Layers, PackageOpen, Settings, ShoppingCart, Utensils, FileText, LogOut } from "lucide-react";
import { useRestaurantData } from "@/lib/restaurantData";
import { useAuth } from "@/components/AuthProvider";

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Setup", path: "/setup", icon: Settings },
  { label: "Command Center", path: "/dashboard", icon: LayoutDashboard },
  { label: "Menu Intelligence", path: "/menu", icon: Utensils },
  { label: "POS Simulator", path: "/pos", icon: ShoppingCart },
  { label: "Order Logs", path: "/orders", icon: PackageOpen },
  { label: "Combo Engine", path: "/combos", icon: Layers },
  { label: "Call Agent", path: "/voice", icon: ShoppingCart },
  { label: "Platform Settings", path: "/platform-settings", icon: Globe },
  { label: "Insights", path: "/insights", icon: FileText },
];

export function DashboardNav() {
  const location = useLocation();
  const { profile } = useRestaurantData();
  const { user, signOut } = useAuth();

  const visibleNavItems = navItems.filter((item) => {
    if (item.path === "/setup" && profile.setupComplete) return false;
    return true;
  });

  const badgeName = profile.name || user?.email?.split("@")[0] || "Guest";

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
          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-secondary/30 pl-3 pr-1 py-1">
            <span className="text-xs font-semibold text-foreground/80 hidden sm:inline-block">
              {badgeName}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">
              {badgeName.charAt(0).toUpperCase()}
            </div>
          </div>

          {user ? (
            <button
              onClick={() => signOut()}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}