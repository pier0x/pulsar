import * as React from "react";
import { cn } from "~/lib/utils";

export interface SegmentedBarProps {
  /** 0–1 fill ratio */
  value: number;
  /** Total number of discrete segments */
  segments?: number;
  /** Status determines fill color */
  status?: "neutral" | "good" | "warning" | "over";
  /** Bar height variant */
  size?: "hero" | "standard" | "compact";
  /** Optional label above left */
  label?: string;
  /** Optional numeric readout above right */
  readout?: string;
  className?: string;
}

const statusFills: Record<string, string> = {
  neutral: "bg-nd-text-display",
  good: "bg-nd-success",
  warning: "bg-nd-warning",
  over: "bg-nd-accent",
};

const sizeHeights: Record<string, string> = {
  hero: "h-5",
  standard: "h-3",
  compact: "h-1.5",
};

function SegmentedBar({
  value,
  segments = 20,
  status = "neutral",
  size = "standard",
  label,
  readout,
  className,
}: SegmentedBarProps) {
  const filled = Math.round(Math.min(Math.max(value, 0), 1) * segments);
  const overflow = value > 1 ? Math.round((value - 1) * segments) : 0;
  const fillColor = statusFills[status];
  const height = sizeHeights[size];

  return (
    <div className={cn("w-full", className)}>
      {(label || readout) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-label text-nd-text-secondary">{label}</span>}
          {readout && <span className="font-mono text-[14px] text-nd-text-primary">{readout}</span>}
        </div>
      )}
      <div className="flex gap-[2px]">
        {Array.from({ length: segments }, (_, i) => {
          const isFilled = i < filled;
          const isOverflow = overflow > 0 && i >= segments - overflow;
          return (
            <div
              key={i}
              className={cn(
                "flex-1",
                height,
                isOverflow
                  ? "bg-nd-accent"
                  : isFilled
                    ? fillColor
                    : "bg-nd-border"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export { SegmentedBar };
