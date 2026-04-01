import { cn } from "~/lib/utils";
import { Wallet } from "lucide-react";
import { Link } from "@remix-run/react";

export interface WalletData {
  id: string;
  name: string;
  chain: string;
  chainIcon?: string;
  address: string;
  balance: string;
  balanceUsd: string;
}

interface StackedCardsProps {
  wallets: WalletData[];
  className?: string;
}

function formatAddress(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function StackedCards({ wallets, className }: StackedCardsProps) {
  return (
    <div
      className={cn(
        "rounded-[12px] bg-nd-surface border border-nd-border p-4 sm:p-6 h-full",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-label text-nd-text-secondary">ACCOUNTS</p>
        <span className="font-mono text-[11px] text-nd-text-disabled tabular-nums">
          {wallets.length}
        </span>
      </div>

      {wallets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Wallet size={24} strokeWidth={1.5} className="text-nd-text-disabled mb-3" />
          <p className="text-caption text-nd-text-disabled mb-3">No accounts yet</p>
          <Link
            to="/accounts"
            className="font-mono text-[11px] uppercase tracking-[0.06em] text-nd-interactive hover:underline"
          >
            ADD ACCOUNT →
          </Link>
        </div>
      ) : (
        <div className="space-y-0 max-h-[300px] overflow-y-auto">
          {wallets.map((w, i) => (
            <div
              key={w.id}
              className={cn(
                "flex items-center justify-between py-2.5",
                i < wallets.length - 1 && "border-b border-nd-border"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-nd-text-primary truncate">
                    {w.name}
                  </span>
                  <span className="text-[10px] font-mono uppercase text-nd-text-disabled">
                    {w.chain}
                  </span>
                </div>
                {w.address && !w.address.startsWith("/") && !w.address.startsWith("$") && (
                  <span className="font-mono text-[10px] text-nd-text-disabled">
                    {formatAddress(w.address)}
                  </span>
                )}
              </div>
              <span className="font-mono text-[14px] text-nd-text-primary shrink-0 ml-3">
                {w.balanceUsd}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
