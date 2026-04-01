import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-[13px] uppercase tracking-[0.06em] transition-nd cursor-pointer disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-nd-text-display text-nd-black hover:bg-nd-text-primary",
        secondary:
          "bg-transparent border border-nd-border-visible text-nd-text-primary hover:border-nd-text-secondary hover:text-nd-text-display",
        ghost:
          "bg-transparent text-nd-text-secondary hover:text-nd-text-primary",
        destructive:
          "bg-transparent border border-nd-accent text-nd-accent hover:bg-nd-accent-subtle",
        link: "text-nd-interactive underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 rounded-[999px]",
        sm: "h-9 px-4 rounded-[999px] text-[12px]",
        lg: "h-12 px-8 rounded-[999px]",
        icon: "size-11 rounded-[999px]",
        "icon-sm": "size-9 rounded-[999px]",
        technical: "h-11 px-6 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
