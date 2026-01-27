import * as React from "react";
import { cn } from "~/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {}

function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500",
        "focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "transition-colors",
        className
      )}
      {...props}
    />
  );
}

export { Input };
