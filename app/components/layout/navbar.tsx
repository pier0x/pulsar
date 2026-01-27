import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Form } from "@remix-run/react";
import { BellIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon, UserCircleIcon } from "@heroicons/react/20/solid";

interface User {
  id: string;
  username: string;
  avatarUrl: string | null;
}

interface NavbarProps {
  user: User;
}

// Generate initials from username (fallback if no avatar)
function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

// Generate a consistent color based on username (fallback)
function getAvatarColor(username: string): string {
  const colors = [
    "bg-blue-600",
    "bg-purple-600",
    "bg-emerald-600",
    "bg-orange-600",
    "bg-pink-600",
    "bg-cyan-600",
    "bg-indigo-600",
    "bg-rose-600",
  ];
  const index = username.charCodeAt(0) % colors.length;
  return colors[index];
}

export default function Navbar({ user }: NavbarProps) {
  return (
    <div className="z-40 flex h-16 shrink-0 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex justify-between w-full">
        {/* Title */}
        <div>
          <h2 className="text-white text-2xl font-semibold">Dashboard</h2>
        </div>

        {/* Action items */}
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <span className="sr-only">View notifications</span>
            <BellIcon aria-hidden="true" className="size-6" />
          </button>

          {/* Separator */}
          <div
            aria-hidden="true"
            className="hidden lg:block lg:h-6 lg:w-px lg:bg-zinc-700"
          />

          {/* Profile dropdown */}
          <Menu as="div" className="relative">
            <MenuButton className="relative flex items-center cursor-pointer group focus:outline-none">
              {/* Avatar */}
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="size-9 rounded-full shrink-0 object-cover"
                />
              ) : (
                <div
                  className={`size-9 rounded-full ${getAvatarColor(user.username)} flex items-center justify-center shrink-0`}
                >
                  <span className="text-sm font-semibold text-white">
                    {getInitials(user.username)}
                  </span>
                </div>
              )}
              <span className="hidden lg:flex lg:items-center">
                <span
                  aria-hidden="true"
                  className="ml-3 text-sm font-semibold text-white group-hover:text-zinc-300 transition-colors"
                >
                  {user.username}
                </span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="ml-2 size-5 text-zinc-500 group-hover:text-zinc-400 transition-colors"
                />
              </span>
            </MenuButton>
            <MenuItems
              transition
              className="absolute right-0 z-10 mt-2.5 w-48 origin-top-right rounded-xl bg-zinc-800 border border-zinc-700 py-2 shadow-lg transition focus:outline-none data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-leave:duration-75 data-enter:ease-out data-leave:ease-in"
            >
              <MenuItem>
                <div className="px-4 py-2 border-b border-zinc-700">
                  <p className="text-sm font-medium text-white">{user.username}</p>
                  <p className="text-xs text-zinc-500">Logged in</p>
                </div>
              </MenuItem>
              <MenuItem>
                <a
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 data-focus:bg-zinc-700/50 data-focus:text-white cursor-pointer transition-colors focus:outline-none"
                >
                  <UserCircleIcon className="size-4" />
                  Profile Settings
                </a>
              </MenuItem>
              <MenuItem>
                <Form method="post" action="/auth/logout" className="w-full">
                  <button
                    type="submit"
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 data-focus:bg-zinc-700/50 data-focus:text-red-300 cursor-pointer transition-colors text-left focus:outline-none"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </Form>
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>
      </div>
    </div>
  );
}
