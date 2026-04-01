import * as React from "react";
import { cn } from "~/lib/utils";

export interface SectionHeaderProps {
  title: string;
  /** Optional item count badge */
  count?: number;
  /** Right-side action element (e.g., a ghost button) */
  action?: React.ReactNode;
  className?: string;
}

function SectionHeader({ title, count, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div className="flex items-center gap-3">
        <h3 className="text-label text-nd-text-secondary">{title}</h3>
        {count !== undefined && (
          <span className="font-mono text-[11px] text-nd-text-disabled tabular-nums">
            {count}
          </span>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export { SectionHeader };
