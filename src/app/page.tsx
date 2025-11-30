import { Search, ArrowUpRight, Bitcoin, DollarSign } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sidebar } from "@/components/layout/sidebar"
import { PortfolioChart } from "@/components/ui/portfolio-chart"
import { AssetCard } from "@/components/ui/asset-card"
import { TransactionTable } from "@/components/ui/transaction-table"

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">Welcome back, Alex.</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search assets" className="pl-10 bg-secondary/50 border-0 h-11 rounded-xl" />
            </div>
          </div>
        </header>

        {/* Portfolio Overview */}
        <Card className="p-6 lg:p-8 mb-6 shadow-sm border-0">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-6">
            <div className="mb-6 lg:mb-0">
              <p className="text-sm text-muted-foreground mb-2">Portfolio</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
                  373,139<span className="text-muted-foreground">.59</span>
                </h2>
                <span className="text-lg text-muted-foreground">USD</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-success-foreground font-medium">+ 3,289.63 USD</span>
                <span className="text-success-foreground font-medium flex items-center">
                  + 1.37 %
                  <ArrowUpRight className="h-4 w-4 ml-0.5" />
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-lg bg-transparent">
                1D
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg bg-transparent">
                1W
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg bg-transparent">
                1Y
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg bg-transparent">
                ALL
              </Button>
              <Button className="rounded-lg ml-2" size="sm">
                Withdrawal
              </Button>
            </div>
          </div>

          {/* Chart */}
          <PortfolioChart />
        </Card>

        {/* Asset Cards & Stake Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <AssetCard
            icon={<Bitcoin className="h-6 w-6" />}
            name="Crypto"
            amount="361,293"
            decimals=".31"
            currency="USD"
          />
          <AssetCard
            icon={<DollarSign className="h-6 w-6" />}
            name="Cash"
            amount="11,846"
            decimals=".28"
            currency="USD"
          />
          <Card className="p-6 bg-primary text-primary-foreground border-0 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Stake</h3>
              <p className="text-sm opacity-80">Up to 12.34% APY</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 w-fit rounded-lg bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
            >
              Get started
            </Button>
          </Card>
        </div>

        {/* Transactions */}
        <Card className="p-6 lg:p-8 shadow-sm border-0">
          <h3 className="text-xl font-semibold mb-6">Transactions</h3>
          <TransactionTable />
        </Card>
      </main>
    </div>
  )
}
