import { useState, useEffect, useRef } from "react";
import { Form, useLocation, useFetcher } from "@remix-run/react";
import { RefreshCw, X, CheckCircle, AlertCircle, ChevronDown, LogOut, User } from "lucide-react";
import { Logo } from "../ui";
import { NETWORK_INFO, type WalletNetwork } from "~/lib/wallet";
import { cn } from "~/lib/utils";

// --- Helpers ---

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/": "Dashboard",
    "/accounts": "Accounts",
    "/assets": "Assets",
    "/positions": "Positions",
    "/settings": "Settings",
  };
  if (titles[pathname]) return titles[pathname];
  for (const [path, title] of Object.entries(titles)) {
    if (pathname.startsWith(path) && path !== "/") return title;
  }
  return "Dashboard";
}

function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "JUST NOW";
  if (diffMin < 60) return `${diffMin}M AGO`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}H AGO`;
  return `${Math.floor(diffH / 24)}D AGO`;
}

function formatAddress(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

// --- Types ---

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

// --- Refresh Results Panel ---

function RefreshPanel({
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
    <div className="absolute right-0 top-full mt-2 w-80 bg-nd-surface border border-nd-border-visible rounded-[12px] z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-nd-border">
        <span className="text-label text-nd-text-secondary">{headerLabel}</span>
        <button
          onClick={onClose}
          className="p-1 text-nd-text-secondary hover:text-nd-text-primary transition-nd cursor-pointer"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {isRefreshing && !result && (
          <div className="flex items-center gap-3 px-4 py-6">
            <RefreshCw size={16} strokeWidth={1.5} className="text-nd-text-secondary animate-spin shrink-0" />
            <span className="text-caption text-nd-text-secondary">[SYNCING...]</span>
          </div>
        )}

        {result?.error && (
          <div className="flex items-center gap-3 px-4 py-4">
            <AlertCircle size={16} strokeWidth={1.5} className="text-nd-accent shrink-0" />
            <span className="text-caption text-nd-accent">{result.error}</span>
          </div>
        )}

        {result?.accounts && result.accounts.length > 0 && (
          <div className="divide-y divide-nd-border">
            {result.accounts.map((w, i) => {
              const info = NETWORK_INFO[w.network as WalletNetwork];
              const networkName = info?.displayName || w.network;
              const isSuccess = w.status === "success";

              return (
                <div key={`${w.network}-${w.address}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                  {isSuccess ? (
                    <CheckCircle size={14} strokeWidth={1.5} className="text-nd-success shrink-0" />
                  ) : (
                    <AlertCircle size={14} strokeWidth={1.5} className="text-nd-accent shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] text-nd-text-primary">
                        {w.name || networkName}
                      </span>
                      <span className="text-[10px] text-nd-text-disabled font-mono uppercase">
                        {networkName}
                      </span>
                    </div>
                    {isSuccess && w.totalUsd !== undefined && (
                      <span className="font-mono text-[11px] text-nd-text-secondary">
                        ${w.totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                    {!isSuccess && w.error && (
                      <span className="text-[11px] text-nd-accent/70 truncate block font-mono">{w.error}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {result?.accounts && result.accounts.length === 0 && (
          <div className="px-4 py-6 text-center">
            <span className="text-caption text-nd-text-disabled">No accounts to refresh</span>
          </div>
        )}
      </div>

      {/* Footer */}
      {result && !result.error && (
        <div className="px-4 py-2.5 border-t border-nd-border flex items-center justify-between">
          <span className="text-label text-nd-text-disabled">
            {result.accountsSucceeded}/{result.accountsAttempted} ACCOUNTS
          </span>
          {result.durationMs && (
            <span className="text-label text-nd-text-disabled">
              {(result.durationMs / 1000).toFixed(1)}S
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// --- Refresh Button ---

function RefreshButton({ lastRefresh }: { lastRefresh?: LastRefreshData | null }) {
  const fetcher = useFetcher<RefreshResponse>();
  const isRefreshing = fetcher.state !== "idle";
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"live" | "last">("live");
  const [lastResult, setLastResult] = useState<RefreshResponse | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      setLastResult(fetcher.data);
    }
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    if (isRefreshing) {
      setPanelMode("live");
      setPanelOpen(true);
    }
  }, [isRefreshing]);

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
      ? "SYNCING"
      : lastResult?.error
        ? "SYNC FAILED"
        : "SYNC COMPLETE"
    : "LAST SYNC";

  return (
    <div className="relative flex items-center gap-3" ref={panelRef}>
      {/* Last refresh timestamp */}
      {lastRefresh && (
        <button
          type="button"
          onClick={handleLastClick}
          className="hidden sm:block text-label text-nd-text-disabled hover:text-nd-text-secondary transition-nd cursor-pointer whitespace-nowrap"
        >
          LAST: {formatRelativeTime(lastRefresh.timestamp)}
        </button>
      )}

      {/* Refresh button */}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="text-nd-text-secondary hover:text-nd-text-display transition-nd cursor-pointer disabled:opacity-40 p-1.5"
        title="Refresh balances"
      >
        <RefreshCw
          size={18}
          strokeWidth={1.5}
          className={isRefreshing ? "animate-spin" : ""}
        />
      </button>

      {panelOpen && (
        <RefreshPanel
          isRefreshing={isLiveMode ? isRefreshing : false}
          headerLabel={headerLabel}
          result={displayResult}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}

// --- User Menu ---

function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 cursor-pointer group focus:outline-none"
      >
        {/* Avatar — monochrome circle with initials */}
        <div className="size-8 sm:size-9 rounded-full bg-nd-surface-raised border border-nd-border-visible flex items-center justify-center shrink-0">
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-nd-text-secondary">
            {getInitials(user.username)}
          </span>
        </div>
        <span className="hidden sm:flex sm:items-center">
          <span className="text-label text-nd-text-secondary group-hover:text-nd-text-primary transition-nd">
            {user.username.toUpperCase()}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className="ml-1.5 text-nd-text-disabled group-hover:text-nd-text-secondary transition-nd"
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 bg-nd-surface border border-nd-border-visible rounded-md overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-nd-border">
            <p className="font-mono text-[12px] text-nd-text-primary">{user.username}</p>
            <p className="text-label text-nd-text-disabled mt-0.5">LOGGED IN</p>
          </div>

          {/* Menu items */}
          <a
            href="/settings"
            className="flex items-center gap-2.5 px-4 py-2.5 text-label text-nd-text-secondary hover:text-nd-text-primary hover:bg-nd-surface-raised transition-nd cursor-pointer"
          >
            <User size={14} strokeWidth={1.5} />
            SETTINGS
          </a>

          <Form method="post" action="/auth/logout" className="w-full">
            <button
              type="submit"
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-label text-nd-accent hover:bg-nd-accent-subtle transition-nd cursor-pointer text-left"
            >
              <LogOut size={14} strokeWidth={1.5} />
              SIGN OUT
            </button>
          </Form>
        </div>
      )}
    </div>
  );
}

// --- Main Navbar ---

export default function Navbar({ user, lastRefresh }: NavbarProps) {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="z-40 flex h-14 lg:h-16 shrink-0 items-center gap-x-3 sm:gap-x-4 px-1 sm:px-4 lg:px-0">
      <div className="flex justify-between items-center w-full">
        {/* Logo on mobile, page title on desktop */}
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <h2 className="hidden lg:block text-heading text-nd-text-display">{pageTitle}</h2>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-x-3 sm:gap-x-4">
          <RefreshButton lastRefresh={lastRefresh} />

          {/* Separator */}
          <div
            aria-hidden="true"
            className="hidden sm:block h-5 w-px bg-nd-border-visible"
          />

          <UserMenu user={user} />
        </div>
      </div>
    </div>
  );
}
