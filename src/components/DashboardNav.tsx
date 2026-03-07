import { Link, useLocation } from "react-router-dom";
import { Brain, Globe, Home, LayoutDashboard, Layers, PackageOpen, Settings, ShoppingCart, Utensils, FileText, LogOut, Menu, X, Phone } from "lucide-react";
import { useRestaurantData } from "@/lib/restaurantData";
import { useAuth } from "@/components/AuthProvider";
import { useMemo, useState } from "react";

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Setup", path: "/setup", icon: Settings },
  { label: "Command Center", path: "/dashboard", icon: LayoutDashboard },
  { label: "Menu Intelligence", path: "/menu", icon: Utensils },
  { label: "POS Simulator", path: "/pos", icon: ShoppingCart },
  { label: "Order Logs", path: "/orders", icon: PackageOpen },
  { label: "Combo Engine", path: "/combos", icon: Layers },
  { label: "Call Agent", path: "/voice", icon: Phone },
  { label: "Platform Settings", path: "/platform-settings", icon: Globe },
  { label: "Insights", path: "/insights", icon: FileText },
];

function isActivePath(currentPath: string, itemPath: string): boolean {
  if (itemPath === "/") return currentPath === "/";
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

export function DashboardNav() {
  const location = useLocation();
  const { profile, menuItems } = useRestaurantData();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNavItems = useMemo(() => navItems.filter((item) => {
    // Keep Setup accessible until menu data is actually available.
    if (item.path === "/setup" && profile.setupComplete && menuItems.length > 0) return false;
    return true;
  }), [menuItems.length, profile.setupComplete]);

  const badgeName = profile.name || user?.email?.split("@")[0] || "Guest";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-background/95 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="truncate font-display text-base font-bold tracking-tight sm:text-lg">
              Revenue<span className="text-primary">Copilot</span>
            </span>
          </Link>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {visibleNavItems.map((item) => {
            const active = isActivePath(location.pathname, item.path);
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

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border/50 bg-secondary/30 py-1 pl-3 pr-1 sm:flex">
            <span className="max-w-[120px] truncate text-xs font-semibold text-foreground/80">
              {badgeName}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
              {badgeName.charAt(0).toUpperCase()}
            </div>
          </div>

          {user ? (
            <button
              onClick={() => signOut()}
              className="hidden items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary sm:inline-flex"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          ) : (
            <Link
              to="/login"
              className="hidden items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary sm:inline-flex"
            >
              Sign in
            </Link>
          )}

          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary lg:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/30 bg-background/95 px-4 py-3 lg:hidden">
          <nav className="grid grid-cols-1 gap-1">
            {visibleNavItems.map((item) => {
              const active = isActivePath(location.pathname, item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={active ? "nav-pill-active justify-start" : "nav-pill-inactive justify-start"}
                >
                  <item.icon className="mr-1.5 inline h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-border/40 bg-secondary/20 p-2.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{badgeName}</p>
              <p className="text-[10px] text-muted-foreground">Signed-in workspace</p>
            </div>
            {user ? (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  signOut();
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}


