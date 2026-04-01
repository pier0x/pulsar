import { cn } from "~/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "text-[24px]",
  md: "text-[32px]",
  lg: "text-[40px]",
};

export default function Logo({ size = "lg", className }: LogoProps) {
  return (
    <span
      className={cn(
        "font-display font-bold tracking-[-0.02em] text-nd-text-display select-none",
        sizeClasses[size],
        className
      )}
    >
      PULSAR
    </span>
  );
}
