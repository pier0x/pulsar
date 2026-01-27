import * as React from "react";
import { cn } from "~/lib/utils";

export interface SelectProps extends React.ComponentProps<"select"> {}

function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      data-slot="select"
      className={cn(
        "w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white",
        "focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "transition-colors appearance-none cursor-pointer",
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
        backgroundPosition: "right 0.75rem center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "1.5em 1.5em",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

function SelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option className={cn("bg-zinc-800", className)} {...props} />
  );
}

export { Select, SelectOption };
