"use client"

import { useState } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"

const chartData = [
  { time: "9am", value: 365000 },
  { time: "10am", value: 368000 },
  { time: "11am", value: 366500 },
  { time: "12pm", value: 371000 },
  { time: "1pm", value: 369000 },
  { time: "2pm", value: 354584 },
  { time: "3pm", value: 370000 },
  { time: "4pm", value: 368000 },
  { time: "5pm", value: 373139 },
]

export function PortfolioChart() {
  const [tooltipData, setTooltipData] = useState<any>(null)

  return (
    <div className="relative h-64 lg:h-80 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          onMouseMove={(state: any) => {
            if (state.isTooltipActive) {
              setTooltipData(state.activePayload?.[0]?.payload)
            }
          }}
          onMouseLeave={() => setTooltipData(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                const cryptoValue = Math.round(data.value * 0.92)
                const cashValue = data.value - cryptoValue

                return (
                  <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
                    <p className="text-xs text-muted-foreground mb-2">{data.time}</p>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-2xl font-bold">{data.value.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">USD</span>
                      <span className="text-sm text-success-foreground">+ 0.32 %</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-chart-1" />
                          <span className="text-muted-foreground">Crypto</span>
                        </div>
                        <span className="font-medium">{cryptoValue.toLocaleString()}.19 USD</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-chart-3" />
                          <span className="text-muted-foreground">Cash</span>
                        </div>
                        <span className="font-medium">{cashValue.toLocaleString()}.28 USD</span>
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 6,
              fill: "hsl(var(--chart-1))",
              stroke: "hsl(var(--card))",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
