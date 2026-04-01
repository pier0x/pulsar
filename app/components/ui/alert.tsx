import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const alertVariants = cva(
  "font-mono text-[13px] tracking-[0.02em] p-4 border rounded-md",
  {
    variants: {
      variant: {
        default: "border-nd-border-visible text-nd-text-secondary",
        error: "border-nd-accent text-nd-accent",
        success: "border-nd-success text-nd-success",
        warning: "border-nd-warning text-nd-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/** Bracket prefix map for each variant */
const PREFIXES: Record<string, string> = {
  default: "[INFO]",
  error: "[ERROR]",
  success: "[OK]",
  warning: "[WARN]",
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** If true, prepend the bracket prefix automatically */
  prefixed?: boolean;
}

function Alert({
  className,
  variant,
  prefixed = true,
  children,
  ...props
}: AlertProps) {
  const v = variant ?? "default";
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant, className }))}
      {...props}
    >
      {prefixed && (
        <span className="mr-2 font-bold">{PREFIXES[v]}</span>
      )}
      {children}
    </div>
  );
}

export { Alert, alertVariants };
