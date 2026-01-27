import { StackedCards, type WalletData } from "~/components/ui/stacked-cards";
import {
  PortfolioValueChart,
  type PortfolioDataPoint,
} from "~/components/ui/portfolio-value-chart";
import {
  PortfolioBreakdown,
  type BreakdownItem,
} from "~/components/ui/portfolio-breakdown";
import { TopMovers, type MoverItem } from "~/components/ui/top-movers";

const sampleWallets: WalletData[] = [
  {
    id: "1",
    name: "Main Wallet",
    chain: "Ethereum",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE21",
    balance: "2.4521 ETH",
    balanceUsd: "$9,234.12",
  },
  {
    id: "2",
    name: "DeFi Wallet",
    chain: "Arbitrum",
    address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    balance: "1.8732 ETH",
    balanceUsd: "$7,045.67",
  },
  {
    id: "3",
    name: "NFT Vault",
    chain: "Polygon",
    address: "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec",
    balance: "15,432.50 MATIC",
    balanceUsd: "$12,891.45",
  },
  {
    id: "4",
    name: "Trading Account",
    chain: "Base",
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    balance: "0.9821 ETH",
    balanceUsd: "$3,692.18",
  },
];

// Static historical data for the past 30 days (avoids hydration mismatch from Math.random)
const historicalData: PortfolioDataPoint[] = [
  { date: "Dec 28", value: 28000 },
  { date: "Dec 29", value: 28450 },
  { date: "Dec 30", value: 27890 },
  { date: "Dec 31", value: 28920 },
  { date: "Jan 1", value: 29340 },
  { date: "Jan 2", value: 28750 },
  { date: "Jan 3", value: 29180 },
  { date: "Jan 4", value: 30250 },
  { date: "Jan 5", value: 29870 },
  { date: "Jan 6", value: 30420 },
  { date: "Jan 7", value: 31050 },
  { date: "Jan 8", value: 30680 },
  { date: "Jan 9", value: 31290 },
  { date: "Jan 10", value: 30890 },
  { date: "Jan 11", value: 31450 },
  { date: "Jan 12", value: 32100 },
  { date: "Jan 13", value: 31680 },
  { date: "Jan 14", value: 32350 },
  { date: "Jan 15", value: 31920 },
  { date: "Jan 16", value: 32580 },
  { date: "Jan 17", value: 33120 },
  { date: "Jan 18", value: 32750 },
  { date: "Jan 19", value: 33480 },
  { date: "Jan 20", value: 32980 },
  { date: "Jan 21", value: 33650 },
  { date: "Jan 22", value: 34200 },
  { date: "Jan 23", value: 33780 },
  { date: "Jan 24", value: 34520 },
  { date: "Jan 25", value: 34150 },
  { date: "Jan 26", value: 34863 },
];

const currentValue = historicalData[historicalData.length - 1].value;
const startValue = historicalData[0].value;
const changePercent = ((currentValue - startValue) / startValue) * 100;

const breakdownData: BreakdownItem[] = [
  { name: "Ethereum", value: 12450, color: "#627EEA" },
  { name: "Bitcoin", value: 8200, color: "#F7931A" },
  { name: "Polygon", value: 4320, color: "#8247E5" },
  { name: "Solana", value: 3150, color: "#14F195" },
  { name: "Arbitrum", value: 2740, color: "#28A0F0" },
];

const topGainers: MoverItem[] = [
  { name: "Solana", symbol: "SOL", changePercent: 12.45, value: "$3,150" },
  { name: "Arbitrum", symbol: "ARB", changePercent: 8.32, value: "$2,740" },
  { name: "Polygon", symbol: "MATIC", changePercent: 5.18, value: "$4,320" },
];

const topLosers: MoverItem[] = [
  { name: "Chainlink", symbol: "LINK", changePercent: -7.23, value: "$1,420" },
  { name: "Uniswap", symbol: "UNI", changePercent: -4.56, value: "$890" },
  { name: "Aave", symbol: "AAVE", changePercent: -2.89, value: "$2,100" },
];

export default function Index() {
  const wallets = sampleWallets;

  return (
    <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-6 w-full">
      {/* Row 1: Portfolio Value Chart + Stacked Cards */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 min-h-[280px] sm:min-h-[320px] lg:min-h-[360px]">
        <PortfolioValueChart
          data={historicalData}
          currentValue={`$${currentValue.toLocaleString()}`}
          changePercent={changePercent}
        />
      </div>
      <div className="col-span-1 md:col-span-2 lg:col-span-2 min-h-[320px] lg:min-h-[360px]">
        <StackedCards wallets={wallets} />
      </div>

      {/* Row 2: Portfolio Breakdown + Top Gainers + Top Losers */}
      <div className="col-span-1 md:col-span-2 lg:col-span-2">
        <PortfolioBreakdown data={breakdownData} />
      </div>
      <div className="col-span-1 lg:col-span-2">
        <TopMovers title="Top Gainers" items={topGainers} type="gainers" />
      </div>
      <div className="col-span-1 lg:col-span-2">
        <TopMovers title="Top Losers" items={topLosers} type="losers" />
      </div>
    </div>
  );
}
