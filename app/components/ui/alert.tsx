import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

const alertVariants = cva(
  "text-sm p-4 rounded-xl border",
  {
    variants: {
      variant: {
        default: "bg-zinc-800/50 border-zinc-700 text-zinc-300",
        error: "bg-red-500/10 border-red-500/20 text-red-400",
        success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
        warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  animate?: boolean;
}

function Alert({
  className,
  variant,
  animate = true,
  children,
  ...props
}: AlertProps) {
  if (animate) {
    return (
      <motion.div
        data-slot="alert"
        className={cn(alertVariants({ variant }), className)}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Alert, alertVariants };
