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

// Generate sample historical data for the past 30 days
const generateHistoricalData = (): PortfolioDataPoint[] => {
  const data: PortfolioDataPoint[] = [];
  const now = new Date();
  let value = 28000;

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Add some realistic variance
    const change = (Math.random() - 0.45) * 1500;
    value = Math.max(20000, value + change);

    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.round(value),
    });
  }

  return data;
};

const historicalData = generateHistoricalData();
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
    <div className="grid gap-5 grid-cols-6 w-full">
      {/* Row 1: Portfolio Value Chart + Stacked Cards */}
      <div className="col-span-4 min-h-[360px]">
        <PortfolioValueChart
          data={historicalData}
          currentValue={`$${currentValue.toLocaleString()}`}
          changePercent={changePercent}
        />
      </div>
      <div className="col-span-2 min-h-[360px]">
        <StackedCards wallets={wallets} />
      </div>

      {/* Row 2: Portfolio Breakdown + Top Gainers + Top Losers */}
      <div className="col-span-2">
        <PortfolioBreakdown data={breakdownData} />
      </div>
      <div className="col-span-2">
        <TopMovers title="Top Gainers" items={topGainers} type="gainers" />
      </div>
      <div className="col-span-2">
        <TopMovers title="Top Losers" items={topLosers} type="losers" />
      </div>
    </div>
  );
}
