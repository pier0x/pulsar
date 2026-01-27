import { cn } from "~/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-auto",
  md: "h-10 w-auto",
  lg: "h-12 w-auto",
};

export default function Logo({ size = "lg", className }: LogoProps) {
  return (
    <img
      alt="Pulsar"
      src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=500"
      className={cn(sizeClasses[size], className)}
    />
  );
}
