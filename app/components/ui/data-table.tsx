import * as React from "react";
import { cn } from "~/lib/utils";

/* ----------------------------------------------------------------
   DataTable — Nothing Design System
   Header: label style. Numbers right-aligned. No zebra striping.
   Active row: surface-raised bg + left 2px accent bar.
   ---------------------------------------------------------------- */

export interface Column<T> {
  key: string;
  header: string;
  /** "text" left-aligns, "numeric" right-aligns and uses mono font */
  type?: "text" | "numeric";
  /** Custom cell renderer */
  render?: (row: T, index: number) => React.ReactNode;
  /** Column width class, e.g. "w-1/3" */
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Row key extractor */
  getRowKey: (row: T, index: number) => string | number;
  /** Index of the active/highlighted row */
  activeIndex?: number;
  className?: string;
  /** Called when a row is clicked */
  onRowClick?: (row: T, index: number) => void;
}

function DataTable<T>({
  columns,
  data,
  getRowKey,
  activeIndex,
  className,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-nd-border-visible">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "text-label text-nd-text-secondary py-3 px-4 font-normal",
                  col.type === "numeric" ? "text-right" : "text-left",
                  col.width
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const isActive = activeIndex === i;
            return (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                className={cn(
                  "border-b border-nd-border transition-nd",
                  isActive && "bg-nd-surface-raised border-l-2 border-l-nd-accent",
                  onRowClick && "cursor-pointer hover:bg-nd-surface-raised/50"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "py-3 px-4",
                      col.type === "numeric"
                        ? "text-right font-mono text-[14px]"
                        : "text-body-sm",
                      "text-nd-text-primary"
                    )}
                  >
                    {col.render
                      ? col.render(row, i)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable };
