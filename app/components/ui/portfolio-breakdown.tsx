import { useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { cn } from "~/lib/utils";

export interface BreakdownItem {
  name: string;
  value: number;
  color: string;
}

interface PortfolioBreakdownProps {
  data: BreakdownItem[];
  className?: string;
}

const renderActiveShape = (props: any) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
  } = props;

  return (
    <g>
      <text
        x={cx}
        y={cy - 5}
        textAnchor="middle"
        fill="#fff"
        fontSize={12}
        fontWeight={600}
      >
        {payload.name}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fill="#a1a1aa"
        fontSize={11}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 9}
        fill={fill}
      />
    </g>
  );
};

export function PortfolioBreakdown({
  data,
  className,
}: PortfolioBreakdownProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6 h-full",
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <p className="text-zinc-500 text-xs sm:text-sm">Portfolio Breakdown</p>
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-xl sm:text-2xl font-bold text-white mt-1"
        >
          ${total.toLocaleString()}
        </motion.p>
      </div>

      <div className="flex flex-col items-center">
        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-32 h-32 sm:w-40 sm:h-40 shrink-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={55}
                dataKey="value"
                onMouseEnter={onPieEnter}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="w-full space-y-1.5 mt-4"
        >
          {data.map((item, index) => {
            const percent = ((item.value / total) * 100).toFixed(0);
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.05, duration: 0.2 }}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors cursor-pointer",
                  activeIndex === index ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                )}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-white text-xs font-medium">
                    {item.name}
                  </span>
                </div>
                <span className="text-zinc-400 text-xs">{percent}%</span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}
