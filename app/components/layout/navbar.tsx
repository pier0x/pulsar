import { useState, useEffect, useRef } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Form, useLocation, useFetcher } from "@remix-run/react";
import { ArrowPathIcon, XMarkIcon, CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon, UserCircleIcon } from "@heroicons/react/20/solid";
import { Logo } from "../ui";
import { NETWORK_INFO, type WalletNetwork } from "~/lib/wallet";

// Map routes to page titles
function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/": "Dashboard",
    "/accounts": "Accounts",
    "/settings": "Settings",
    "/wallets": "Wallets",
    "/history": "History",
    "/analytics": "Analytics",
  };
  
  if (titles[pathname]) {
    return titles[pathname];
  }
  
  for (const [path, title] of Object.entries(titles)) {
    if (pathname.startsWith(path) && path !== "/") {
      return title;
    }
  }
  
  return "Dashboard";
}

interface User {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface AccountResult {
  name: string | null;
  network: string;
  address: string;
  status: "success" | "error";
  totalUsd?: number;
  error?: string;
}

export interface LastRefreshData {
  timestamp: string;
  accountsSucceeded: number;
  accountsAttempted: number;
  durationMs: number | null;
  accounts: AccountResult[];
}

interface NavbarProps {
  user: User;
  lastRefresh?: LastRefreshData | null;
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

interface RefreshResponse {
  success?: boolean;
  error?: string;
  status?: string;
  accountsAttempted?: number;
  accountsSucceeded?: number;
  accountsFailed?: number;
  durationMs?: number;
  accounts?: AccountResult[];
}

function formatAddress(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  // Over 1 hour: show date/time
  const d = new Date(timestamp);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function WalletResultsPanel({
  isRefreshing,
  headerLabel,
  result,
  onClose,
}: {
  isRefreshing?: boolean;
  headerLabel: string;
  result: RefreshResponse | null;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="text-sm font-medium text-white">{headerLabel}</span>
        <button
          onClick={onClose}
          className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer rounded-md hover:bg-zinc-800"
        >
          <XMarkIcon className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {isRefreshing && !result && (
          <div className="flex items-center gap-3 px-4 py-6">
            <ArrowPathIcon className="size-5 text-blue-400 animate-spin shrink-0" />
            <span className="text-sm text-zinc-400">Refreshing all accounts…</span>
          </div>
        )}

        {result?.error && (
          <div className="flex items-center gap-3 px-4 py-4">
            <ExclamationCircleIcon className="size-5 text-red-400 shrink-0" />
            <span className="text-sm text-red-400">{result.error}</span>
          </div>
        )}

        {result?.accounts && result.accounts.length > 0 && (
          <div className="divide-y divide-zinc-800/50">
            {result.accounts.map((w, i) => {
              const info = NETWORK_INFO[w.network as WalletNetwork];
              const networkName = info?.displayName || w.network;
              const isSuccess = w.status === "success";

              return (
                <div key={`${w.network}-${w.address}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                  {isSuccess ? (
                    <CheckCircleIcon className="size-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ExclamationCircleIcon className="size-4 text-red-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">
                        {w.name || networkName}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {networkName}
                      </span>
                    </div>
                    {isSuccess && w.totalUsd !== undefined && (
                      <span className="text-[11px] text-zinc-400">
                        ${w.totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                    {!isSuccess && w.error && (
                      <span className="text-[11px] text-red-400/70 truncate block">{w.error}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {result?.accounts && result.accounts.length === 0 && (
          <div className="px-4 py-6 text-center">
            <span className="text-sm text-zinc-500">No accounts to refresh</span>
          </div>
        )}
      </div>

      {/* Footer */}
      {result && !result.error && (
        <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            {result.accountsSucceeded}/{result.accountsAttempted} accounts
          </span>
          {result.durationMs && (
            <span className="text-[11px] text-zinc-500">
              {(result.durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function RefreshButton({ lastRefresh }: { lastRefresh?: LastRefreshData | null }) {
  const fetcher = useFetcher<RefreshResponse>();
  const isRefreshing = fetcher.state !== "idle";
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"live" | "last">("live");
  const [lastResult, setLastResult] = useState<RefreshResponse | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Store result when refresh completes
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      setLastResult(fetcher.data);
    }
  }, [fetcher.data, fetcher.state]);

  // Open panel when refresh starts
  useEffect(() => {
    if (isRefreshing) {
      setPanelMode("live");
      setPanelOpen(true);
    }
  }, [isRefreshing]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    if (panelOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [panelOpen]);

  const handleRefresh = () => {
    setLastResult(null);
    setPanelMode("live");
    fetcher.submit(null, { method: "post", action: "/api/refresh" });
  };

  const handleLastClick = () => {
    if (!lastRefresh) return;
    setPanelMode("last");
    setPanelOpen(true);
  };

  // Build the result to show based on panel mode
  const isLiveMode = panelMode === "live";
  const displayResult: RefreshResponse | null = isLiveMode
    ? lastResult
    : lastRefresh
      ? {
          accountsAttempted: lastRefresh.accountsAttempted,
          accountsSucceeded: lastRefresh.accountsSucceeded,
          durationMs: lastRefresh.durationMs ?? undefined,
          accounts: lastRefresh.accounts,
        }
      : null;

  const headerLabel = isLiveMode
    ? isRefreshing
      ? "Refreshing…"
      : lastResult?.error
        ? "Refresh failed"
        : "Refresh complete"
    : "Last Refresh";

  return (
    <div className="relative flex items-center gap-2" ref={panelRef}>
      {/* Last refresh timestamp */}
      {lastRefresh && (
        <button
          type="button"
          onClick={handleLastClick}
          className="hidden sm:block text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          Last: {formatRelativeTime(lastRefresh.timestamp)}
        </button>
      )}

      {/* Refresh button */}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="-m-2 p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
        title="Refresh balances"
      >
        <span className="sr-only">Refresh balances</span>
        <ArrowPathIcon
          aria-hidden="true"
          className={`size-5 sm:size-6 ${isRefreshing ? "animate-spin" : ""}`}
        />
      </button>

      {/* Panel */}
      {panelOpen && (
        <WalletResultsPanel
          isRefreshing={isLiveMode ? isRefreshing : false}
          headerLabel={headerLabel}
          result={displayResult}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}

export default function Navbar({ user, lastRefresh }: NavbarProps) {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="z-40 flex h-14 lg:h-16 shrink-0 items-center gap-x-3 sm:gap-x-4 px-1 sm:px-4 lg:px-8">
      <div className="flex justify-between items-center w-full">
        {/* Logo on mobile, Title on desktop */}
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <h2 className="hidden lg:block text-white text-2xl font-semibold">{pageTitle}</h2>
        </div>

        {/* Action items */}
        <div className="flex items-center gap-x-2 sm:gap-x-4 lg:gap-x-6">
          <RefreshButton lastRefresh={lastRefresh} />

          {/* Separator */}
          <div
            aria-hidden="true"
            className="hidden sm:block h-5 sm:h-6 w-px bg-zinc-700"
          />

          {/* Profile dropdown */}
          <Menu as="div" className="relative">
            <MenuButton className="relative flex items-center cursor-pointer group focus:outline-none">
              {/* Avatar */}
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="size-8 sm:size-9 rounded-full shrink-0 object-cover"
                />
              ) : (
                <div
                  className={`size-8 sm:size-9 rounded-full ${getAvatarColor(user.username)} flex items-center justify-center shrink-0`}
                >
                  <span className="text-xs sm:text-sm font-semibold text-white">
                    {getInitials(user.username)}
                  </span>
                </div>
              )}
              <span className="hidden sm:flex sm:items-center">
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
