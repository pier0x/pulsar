import * as React from "react";
import { cn } from "~/lib/utils";

export interface LabelProps extends React.ComponentProps<"label"> {}

function Label({ className, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn("text-sm font-medium text-zinc-300", className)}
      {...props}
    />
  );
}

export { Label };
