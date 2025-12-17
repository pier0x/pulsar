import { StackedCards, type WalletData } from "~/components/ui/stacked-cards";
import {
  PortfolioValueChart,
  type PortfolioDataPoint,
} from "~/components/ui/portfolio-value-chart";

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

export default function Index() {
  const wallets = sampleWallets;

  return (
    <div className="grid gap-5 grid-cols-6 w-full">
      <div className="col-span-4">
        <PortfolioValueChart
          data={historicalData}
          currentValue={`$${currentValue.toLocaleString()}`}
          changePercent={changePercent}
        />
      </div>
      <div className="col-span-2">
        <StackedCards wallets={wallets} />
      </div>
    </div>
  );
}
