// Collapsible sidebar navigation / Einklappbare Seitenleisten-Navigation
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ScanLine, ClipboardList, TrendingUp, LayoutDashboard, Settings, PanelLeftClose, PanelLeft } from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/scan", label: "Scan", icon: ScanLine },
  { path: "/receipts", label: "Bons", icon: ClipboardList },
  { path: "/prices", label: "Preisverlauf", icon: TrendingUp },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/settings", label: "Einstellungen", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const theme = useSettingsStore((s) => s.theme);

  // Determine effective dark mode for logo selection
  // Effektiven Dark Mode für Logo-Auswahl bestimmen
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo / Logo */}
      <div className="flex h-14 items-center justify-center border-b border-border px-3">
        <img
          src={isDark ? "/logo-dark.svg" : "/logo-light.svg"}
          alt="Kassenzettel Scanner"
          className={cn("transition-all duration-200", collapsed ? "h-8 w-8" : "h-8")}
        />
      </div>

      {/* Navigation items / Navigations-Elemente */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle / Einklapp-Schalter */}
      <div className="border-t border-border p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5 mr-2" />
              <span>Einklappen</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
