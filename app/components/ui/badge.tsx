import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center border px-3 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap transition-nd",
  {
    variants: {
      variant: {
        default: "border-nd-border-visible text-nd-text-secondary",
        active: "border-nd-text-display text-nd-text-display",
        success: "border-nd-success text-nd-success",
        warning: "border-nd-warning text-nd-warning",
        destructive: "border-nd-accent text-nd-accent",
      },
      shape: {
        pill: "rounded-[999px]",
        technical: "rounded-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "pill",
    },
  }
);

function Badge({
  className,
  variant,
  shape,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, shape, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
