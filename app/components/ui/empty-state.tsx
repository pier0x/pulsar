import * as React from "react";
import { cn } from "~/lib/utils";

export interface EmptyStateProps {
  headline: string;
  description?: string;
  /** Optional action button */
  action?: React.ReactNode;
  /** Show dot-matrix background */
  dotGrid?: boolean;
  className?: string;
}

function EmptyState({
  headline,
  description,
  action,
  dotGrid = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-nd-4xl px-nd-xl",
        dotGrid && "dot-grid-subtle",
        className
      )}
    >
      <h3 className="text-subheading text-nd-text-secondary mb-2">
        {headline}
      </h3>
      {description && (
        <p className="text-caption text-nd-text-disabled max-w-[320px]">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export { EmptyState };
