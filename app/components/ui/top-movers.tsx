import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "~/lib/utils";

export interface MoverItem {
  name: string;
  symbol: string;
  changePercent: number;
  value: string;
  icon?: string;
}

interface TopMoversProps {
  title: string;
  items: MoverItem[];
  type: "gainers" | "losers";
  className?: string;
}

export function TopMovers({ title, items, type, className }: TopMoversProps) {
  const isGainers = type === "gainers";
  const Icon = isGainers ? TrendingUp : TrendingDown;
  const accentColor = isGainers ? "text-emerald-400" : "text-red-400";
  const bgAccent = isGainers ? "bg-emerald-400/10" : "bg-red-400/10";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "rounded-2xl bg-zinc-900 border border-zinc-800 p-5 h-full flex flex-col",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className={cn("p-1.5 rounded-lg", bgAccent)}>
          <Icon className={cn("w-4 h-4", accentColor)} />
        </div>
        <h3 className="text-white font-medium">{title}</h3>
      </div>

      {/* List */}
      <div className="space-y-2 flex-1">
        {items.map((item, index) => (
          <motion.div
            key={item.symbol}
            initial={{ opacity: 0, x: isGainers ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + index * 0.1, duration: 0.3 }}
            className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              {item.icon ? (
                <img
                  src={item.icon}
                  alt={item.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                  <span className="text-zinc-300 text-xs font-bold">
                    {item.symbol.slice(0, 2)}
                  </span>
                </div>
              )}
              <div>
                <p className="text-white text-sm font-medium">{item.symbol}</p>
                <p className="text-zinc-500 text-xs">{item.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn("text-sm font-semibold", accentColor)}>
                {isGainers ? "+" : ""}
                {item.changePercent.toFixed(2)}%
              </p>
              <p className="text-zinc-500 text-xs">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
