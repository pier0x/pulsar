import * as React from "react";
import { cn } from "~/lib/utils";

export interface LabelProps extends React.ComponentProps<"label"> {}

function Label({ className, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn("text-label text-nd-text-secondary block", className)}
      {...props}
    />
  );
}

export { Label };
