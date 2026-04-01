import { NavLink } from "@remix-run/react";
import { LayoutDashboard, Wallet, Box, BarChart3, Settings } from "lucide-react";
import { cn } from "~/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/" },
  { name: "Accounts", href: "/accounts" },
  { name: "Assets", href: "/assets" },
  { name: "Positions", href: "/positions" },
  { name: "Settings", href: "/settings" },
];

const icons: Record<string, typeof LayoutDashboard> = {
  Dashboard: LayoutDashboard,
  Accounts: Wallet,
  Assets: Box,
  Positions: BarChart3,
  Settings: Settings,
};

export default function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-nd-black border-t border-nd-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {navigation.map((item) => {
          const Icon = icons[item.name];
          return (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1.5 px-2 py-2 min-w-[56px] transition-nd relative",
                  isActive
                    ? "text-nd-text-display"
                    : "text-nd-text-disabled"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active dot indicator */}
                  <span
                    className={cn(
                      "absolute top-1 w-1 h-1 rounded-full transition-nd",
                      isActive ? "bg-nd-accent" : "bg-transparent"
                    )}
                  />
                  <Icon size={20} strokeWidth={1.5} />
                  <span className="text-[10px] font-mono uppercase tracking-[0.06em]">
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
