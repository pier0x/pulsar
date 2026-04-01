import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { cn } from "~/lib/utils";

export interface PortfolioDataPoint {
  date: string;
  value: number;
}

interface PortfolioValueChartProps {
  data: PortfolioDataPoint[];
  currentValue: string;
  changePercent: number;
  className?: string;
}

function formatValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PortfolioValueChart({
  data,
  currentValue,
  changePercent,
  className,
}: PortfolioValueChartProps) {
  const isPositive = changePercent >= 0;

  return (
    <div
      className={cn(
        "rounded-[12px] bg-nd-surface border border-nd-border p-4 sm:p-6 h-full",
        className
      )}
    >
      {/* Header — 3-layer hierarchy */}
      <div className="mb-6 sm:mb-8">
        <p className="text-label text-nd-text-secondary mb-2">PORTFOLIO VALUE</p>
        <h2 className="text-display-lg text-nd-text-display leading-none">
          {currentValue}
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={cn(
              "font-mono text-[14px]",
              isPositive ? "text-nd-success" : "text-nd-accent"
            )}
          >
            {isPositive ? "↑" : "↓"} {isPositive ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
          <span className="text-label text-nd-text-disabled">30D</span>
        </div>
      </div>

      {/* Chart — single white line, no area fill */}
      <div className="h-32 sm:h-40 lg:h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              horizontal={true}
              vertical={false}
              stroke="#222222"
              strokeDasharray=""
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#999999", fontSize: 11, fontFamily: "Space Mono" }}
              tickMargin={8}
              minTickGap={40}
            />
            <YAxis hide domain={["dataMin - 1000", "dataMax + 1000"]} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-nd-surface-raised border border-nd-border-visible rounded-md px-3 py-2">
                      <p className="font-mono text-[14px] text-nd-text-display">
                        {formatValue(payload[0].value as number)}
                      </p>
                      <p className="text-label text-nd-text-disabled mt-0.5">
                        {payload[0].payload.date}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#FFFFFF"
              strokeWidth={1.5}
              dot={false}
              activeDot={{
                r: 3,
                fill: "#FFFFFF",
                stroke: "#000000",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
