import { NavLink } from "@remix-run/react";
import { HomeIcon, WalletIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { HomeIcon as HomeIconSolid, WalletIcon as WalletIconSolid, Cog6ToothIcon as Cog6ToothIconSolid } from "@heroicons/react/24/solid";
import { cn } from "~/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: HomeIcon, activeIcon: HomeIconSolid },
  { name: "Accounts", href: "/accounts", icon: WalletIcon, activeIcon: WalletIconSolid },
  { name: "Settings", href: "/settings", icon: Cog6ToothIcon, activeIcon: Cog6ToothIconSolid },
];

export default function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[64px]",
                isActive
                  ? "text-white"
                  : "text-zinc-500 active:bg-zinc-800"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <item.activeIcon className="size-6" />
                ) : (
                  <item.icon className="size-6" />
                )}
                <span className="text-[10px] font-medium">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
