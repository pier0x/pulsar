import { NavLink } from "@remix-run/react";
import { HomeIcon, WalletIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { cn } from "~/lib/utils";
import Logo from "../ui/logo";

const navigation = [
  { name: "Dashboard", href: "/", icon: HomeIcon },
  { name: "Accounts", href: "/accounts", icon: WalletIcon },
];

export default function Sidebar() {
  return (
    <div className="hidden lg:inset-y-0 lg:z-50 lg:flex lg:w-80 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-zinc-800/20 rounded-4xl p-10">
        <div className="flex h-16 shrink-0 items-center">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="space-y-3">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <NavLink
                      to={item.href}
                      end={item.href === "/"}
                      className={({ isActive }) =>
                        cn(
                          isActive
                            ? "text-white"
                            : "text-zinc-500 hover:text-zinc-300",
                          "group flex gap-x-3 py-2 text-sm/6 font-semibold transition-colors"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            aria-hidden="true"
                            className={cn(
                              isActive
                                ? "text-white"
                                : "text-zinc-500 group-hover:text-zinc-300",
                              "size-6 shrink-0 transition-colors"
                            )}
                          />
                          {item.name}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
            <li className="mt-auto">
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    isActive
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-300",
                    "group flex gap-x-3 py-2 text-sm/6 font-semibold transition-colors"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Cog6ToothIcon
                      aria-hidden="true"
                      className={cn(
                        isActive
                          ? "text-white"
                          : "text-zinc-500 group-hover:text-zinc-300",
                        "size-6 shrink-0 transition-colors"
                      )}
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
