import type React from "react"
import { Card } from "~/components/ui/card"

interface AssetCardProps {
  icon: React.ReactNode
  name: string
  amount: string
  decimals: string
  currency: string
}

export function AssetCard({ icon, name, amount, decimals, currency }: AssetCardProps) {
  return (
    <Card className="p-6 border-0 shadow-sm flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-secondary/70 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">{name}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">{amount}</span>
          <span className="text-lg text-muted-foreground">{decimals}</span>
          <span className="text-sm text-muted-foreground ml-1">{currency}</span>
        </div>
      </div>
    </Card>
  )
}
