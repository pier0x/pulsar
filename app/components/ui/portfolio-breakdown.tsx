import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { SegmentedBar } from "./segmented-bar";

export interface BreakdownChild {
  label: string;
  value: number;
  source: string;
}

export interface BreakdownItem {
  name: string;
  value: number;
  color: string;
  children?: BreakdownChild[];
}

interface PortfolioBreakdownProps {
  data: BreakdownItem[];
  className?: string;
}

export function PortfolioBreakdown({
  data,
  className,
}: PortfolioBreakdownProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const handleItemClick = (index: number) => {
    const item = data[index];
    if (item.children && item.children.length > 0) {
      setExpandedIndex(expandedIndex === index ? null : index);
    }
  };

  return (
    <div
      className={cn(
        "rounded-[12px] bg-nd-surface border border-nd-border p-4 sm:p-6 h-full",
        className
      )}
    >
      {/* Header */}
      <div className="mb-6">
        <p className="text-label text-nd-text-secondary mb-2">BREAKDOWN</p>
        <p className="font-mono text-[24px] text-nd-text-display">
          ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </p>
      </div>

      {/* Segmented bars per category */}
      <div className="space-y-4">
        {data.map((item, index) => {
          const percent = total > 0 ? (item.value / total) : 0;
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedIndex === index;

          return (
            <div key={item.name}>
              <div
                className={cn(
                  "transition-nd",
                  hasChildren && "cursor-pointer"
                )}
                onClick={() => handleItemClick(index)}
              >
                {/* Label row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-label text-nd-text-secondary">
                      {item.name.toUpperCase()}
                    </span>
                    {hasChildren && (
                      <ChevronDown
                        size={12}
                        strokeWidth={1.5}
                        className={cn(
                          "text-nd-text-disabled transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-nd-text-primary">
                      ${item.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                    <span className="font-mono text-[11px] text-nd-text-disabled">
                      {(percent * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Segmented bar */}
                <SegmentedBar
                  value={percent}
                  segments={20}
                  status="neutral"
                  size="compact"
                />
              </div>

              {/* Expanded children */}
              <AnimatePresence>
                {isExpanded && hasChildren && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="ml-0 mt-2 space-y-1 pb-1">
                      {item.children!.map((child, childIdx) => (
                        <div
                          key={`${child.label}-${child.source}-${childIdx}`}
                          className="flex items-center justify-between py-1 pl-2 border-l border-nd-border"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[11px] text-nd-text-secondary truncate">
                              {child.label}
                            </span>
                            <span className="text-[10px] text-nd-text-disabled truncate shrink-0">
                              · {child.source}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-nd-text-disabled shrink-0 ml-2">
                            ${child.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
