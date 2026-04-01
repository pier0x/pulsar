import * as React from "react";
import { cn } from "~/lib/utils";

export interface StatRowProps {
  label: string;
  value: React.ReactNode;
  /** Unit displayed smaller next to value */
  unit?: string;
  /** Status color applied to value: "default" | "success" | "warning" | "accent" */
  status?: "default" | "success" | "warning" | "accent";
  /** Trend direction — renders arrow and inherits status color */
  trend?: "up" | "down";
  /** Show bottom divider (default true) */
  divider?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const statusColors: Record<string, string> = {
  default: "text-nd-text-primary",
  success: "text-nd-success",
  warning: "text-nd-warning",
  accent: "text-nd-accent",
};

function StatRow({
  label,
  value,
  unit,
  status = "default",
  trend,
  divider = true,
  className,
  children,
}: StatRowProps) {
  const valueColor = statusColors[status];

  return (
    <div
      className={cn(
        "flex items-center justify-between py-3",
        divider && "border-b border-nd-border",
        className
      )}
    >
      <span className="text-label text-nd-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        {children}
        <span className={cn("font-mono text-[16px]", valueColor)}>
          {trend && (
            <span className="mr-1 text-[12px]">
              {trend === "up" ? "↑" : "↓"}
            </span>
          )}
          {value}
          {unit && (
            <span className="text-label ml-1 align-baseline">{unit}</span>
          )}
        </span>
      </div>
    </div>
  );
}

export { StatRow };
