import { cn } from "~/lib/utils";

export interface MoverItem {
  name: string;
  symbol: string;
  changePercent: number;
  value: string;
  icon?: string;
}

interface TopMoversProps {
  title: string;
  items: MoverItem[];
  type: "gainers" | "losers";
  className?: string;
}

export function TopMovers({ title, items, type, className }: TopMoversProps) {
  const isGainers = type === "gainers";

  return (
    <div
      className={cn(
        "rounded-[12px] bg-nd-surface border border-nd-border p-4 sm:p-6 h-full",
        className
      )}
    >
      {/* Header */}
      <p className="text-label text-nd-text-secondary mb-4">
        {title.toUpperCase()}
      </p>

      {items.length === 0 ? (
        <p className="text-caption text-nd-text-disabled py-4">
          No data yet
        </p>
      ) : (
        <div className="space-y-0">
          {items.map((item, index) => (
            <div
              key={`${item.symbol}-${index}`}
              className={cn(
                "flex items-center justify-between py-2.5",
                index < items.length - 1 && "border-b border-nd-border"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[11px] text-nd-text-disabled uppercase w-8 shrink-0 tabular-nums">
                  {item.symbol}
                </span>
                <span className="text-body-sm text-nd-text-primary truncate">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[12px] text-nd-text-secondary">
                  {item.value}
                </span>
                <span
                  className={cn(
                    "font-mono text-[12px] tabular-nums min-w-[60px] text-right",
                    isGainers ? "text-nd-success" : "text-nd-accent"
                  )}
                >
                  {isGainers ? "↑" : "↓"} {Math.abs(item.changePercent).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
