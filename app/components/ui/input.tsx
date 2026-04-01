import * as React from "react";
import { cn } from "~/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  /** "underline" = bottom-border only (default), "bordered" = full border */
  inputStyle?: "underline" | "bordered";
}

function Input({ className, type, inputStyle = "bordered", ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full h-11 px-4 font-mono text-nd-text-primary placeholder:text-nd-text-disabled bg-transparent",
        "focus:outline-none transition-nd",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        inputStyle === "underline"
          ? "border-b border-nd-border-visible rounded-none focus:border-nd-text-primary px-0"
          : "border border-nd-border-visible rounded-md focus:border-nd-text-primary",
        className
      )}
      {...props}
    />
  );
}

export { Input };
