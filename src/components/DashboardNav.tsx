import { Link, useLocation } from "react-router-dom";
import { BarChart3, Brain, Mic, Utensils, Layers, FileText, Home, Settings, ShoppingCart } from "lucide-react";

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Setup", path: "/setup", icon: Settings },
  { label: "Command Center", path: "/dashboard", icon: BarChart3 },
  { label: "Menu Intelligence", path: "/menu", icon: Utensils },
  { label: "POS Orders", path: "/orders", icon: ShoppingCart },
  { label: "Combo Engine", path: "/combos", icon: Layers },
  { label: "Voice Copilot", path: "/voice", icon: Mic },
  { label: "Insights", path: "/insights", icon: FileText },
];

export function DashboardNav() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            Revenue<span className="text-primary">Copilot</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={active ? "nav-pill-active" : "nav-pill-inactive"}
              >
                <item.icon className="mr-1.5 inline h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold sm:flex">
            R
          </div>
        </div>
      </div>
    </header>
  );
}
