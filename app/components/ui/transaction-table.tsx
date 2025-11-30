import { ArrowUpRight } from "lucide-react"
import { Badge } from "~/components/ui/badge"

const transactions = [
  {
    time: "3m ago",
    type: "Buy",
    send: "500 USDT",
    receive: "0.00489 BTC",
    txHash: "0xa1b2c3d4...890",
  },
  {
    time: "1h ago",
    type: "Sell",
    send: "0.25 ETH",
    receive: "892.45 USDT",
    txHash: "0xf5e6d7c8...321",
  },
  {
    time: "5h ago",
    type: "Buy",
    send: "1000 USDT",
    receive: "1.25 SOL",
    txHash: "0x9a8b7c6d...654",
  },
  {
    time: "1d ago",
    type: "Transfer",
    send: "0.01 BTC",
    receive: "-",
    txHash: "0x4d3c2b1a...987",
  },
]

export function TransactionTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Time</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Send</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
              <span className="sr-only">Arrow</span>
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Receive</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tx Hash</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, index) => (
            <tr key={index} className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
              <td className="py-4 px-4 text-sm text-muted-foreground">{tx.time}</td>
              <td className="py-4 px-4">
                <Badge
                  variant={tx.type === "Buy" ? "default" : tx.type === "Sell" ? "secondary" : "outline"}
                  className="rounded-md"
                >
                  {tx.type}
                </Badge>
              </td>
              <td className="py-4 px-4 text-sm font-medium">
                <div className="flex items-center gap-2">
                  {tx.type === "Buy" && (
                    <div className="w-5 h-5 rounded-full bg-[#26A69A] flex items-center justify-center text-white text-xs">
                      T
                    </div>
                  )}
                  {tx.type === "Sell" && (
                    <div className="w-5 h-5 rounded-full bg-[#627EEA] flex items-center justify-center text-white text-xs">
                      E
                    </div>
                  )}
                  {tx.send}
                </div>
              </td>
              <td className="py-4 px-4 text-center">
                <span className="text-muted-foreground">→</span>
              </td>
              <td className="py-4 px-4 text-sm font-medium">
                {tx.receive !== "-" && (
                  <div className="flex items-center gap-2">
                    {tx.type === "Buy" && (
                      <div className="w-5 h-5 rounded-full bg-[#F7931A] flex items-center justify-center text-white text-xs">
                        B
                      </div>
                    )}
                    {tx.type === "Sell" && (
                      <div className="w-5 h-5 rounded-full bg-[#26A69A] flex items-center justify-center text-white text-xs">
                        T
                      </div>
                    )}
                    {tx.receive}
                  </div>
                )}
                {tx.receive === "-" && <span className="text-muted-foreground">{tx.receive}</span>}
              </td>
              <td className="py-4 px-4 text-sm text-muted-foreground">{tx.txHash}</td>
              <td className="py-4 px-4">
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
