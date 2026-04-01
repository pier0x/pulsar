import { NavLink } from "@remix-run/react";
import { LayoutDashboard, Wallet, Box, BarChart3, Settings } from "lucide-react";
import { cn } from "~/lib/utils";
import { Logo } from "../ui";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Accounts", href: "/accounts", icon: Wallet },
  { name: "Assets", href: "/assets", icon: Box },
  { name: "Positions", href: "/positions", icon: BarChart3 },
];

export default function Sidebar() {
  return (
    <div className="hidden lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-6 overflow-y-auto bg-nd-black p-8">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center">
          <Logo />
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-8">
            <li>
              <ul role="list" className="space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <NavLink
                      to={item.href}
                      end={item.href === "/"}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-x-3 py-2.5 px-3 text-label transition-nd rounded-md",
                          isActive
                            ? "text-nd-text-display bg-nd-surface"
                            : "text-nd-text-disabled hover:text-nd-text-secondary"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Active indicator */}
                          <span
                            className={cn(
                              "w-[2px] h-4 rounded-full transition-nd",
                              isActive ? "bg-nd-accent" : "bg-transparent"
                            )}
                          />
                          <item.icon
                            aria-hidden="true"
                            size={18}
                            strokeWidth={1.5}
                            className="shrink-0"
                          />
                          {item.name}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>

            {/* Settings at bottom */}
            <li className="mt-auto">
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-x-3 py-2.5 px-3 text-label transition-nd rounded-md",
                    isActive
                      ? "text-nd-text-display bg-nd-surface"
                      : "text-nd-text-disabled hover:text-nd-text-secondary"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "w-[2px] h-4 rounded-full transition-nd",
                        isActive ? "bg-nd-accent" : "bg-transparent"
                      )}
                    />
                    <Settings
                      aria-hidden="true"
                      size={18}
                      strokeWidth={1.5}
                      className="shrink-0"
                    />
                    Settings
                  </>
                )}
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
