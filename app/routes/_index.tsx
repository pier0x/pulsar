import { useState, useEffect } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { getCurrentUser } from "~/lib/auth";
import { Hero } from "~/components/landing/hero";
import { AuthModal } from "~/components/auth/auth-modal";

// Import dashboard components
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
import Sidebar from "~/components/layout/sidebar";
import Navbar from "~/components/layout/navbar";
import MobileNav from "~/components/layout/mobile-nav";

export const meta: MetaFunction = () => {
  return [
    { title: "Pulsar - Track Your Crypto Portfolio" },
    { name: "description", content: "Monitor all your wallets across multiple chains in one beautiful dashboard" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser(request);
  return json({ user });
}

// Sample data for dashboard
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

const historicalData: PortfolioDataPoint[] = [
  { date: "Dec 28", value: 28000 },
  { date: "Dec 29", value: 28450 },
  { date: "Dec 30", value: 27800 },
  { date: "Dec 31", value: 29100 },
  { date: "Jan 1", value: 30200 },
  { date: "Jan 2", value: 29800 },
  { date: "Jan 3", value: 31500 },
  { date: "Jan 4", value: 32100 },
  { date: "Jan 5", value: 31200 },
  { date: "Jan 6", value: 32800 },
];

const breakdownData: BreakdownItem[] = [
  { name: "Ethereum", value: 15234.56, percentage: 46.5, color: "#627EEA" },
  { name: "Polygon", value: 8921.33, percentage: 27.2, color: "#8247E5" },
  { name: "Bitcoin", value: 5432.10, percentage: 16.6, color: "#F7931A" },
  { name: "Solana", value: 3175.43, percentage: 9.7, color: "#00FFA3" },
];

const topGainers: MoverItem[] = [
  { symbol: "ETH", name: "Ethereum", changePercent: 5.23, value: "$3,892.45" },
  { symbol: "SOL", name: "Solana", changePercent: 8.91, value: "$187.32" },
  { symbol: "ARB", name: "Arbitrum", changePercent: 3.45, value: "$1.23" },
];

const topLosers: MoverItem[] = [
  { symbol: "MATIC", name: "Polygon", changePercent: -2.34, value: "$0.89" },
  { symbol: "AVAX", name: "Avalanche", changePercent: -1.82, value: "$42.15" },
  { symbol: "LINK", name: "Chainlink", changePercent: -0.95, value: "$18.72" },
];

function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const openLogin = () => {
    setAuthMode("login");
    setModalOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setModalOpen(true);
  };

  const switchMode = () => {
    setAuthMode(authMode === "login" ? "register" : "login");
  };

  return (
    <>
      <Hero onLoginClick={openLogin} onRegisterClick={openRegister} />
      <AuthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={authMode}
        onSwitchMode={switchMode}
      />
    </>
  );
}

function Dashboard({ user }: { user: { id: string; username: string; avatarUrl: string | null } }) {
  return (
    <div className="relative h-screen p-2 sm:p-4 flex w-full flex-row overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="shrink-0 pt-4 lg:pt-10">
          <Navbar user={user} />
        </div>
        <main className="flex-1 overflow-y-auto py-4 lg:py-10 pb-24 lg:pb-10">
          <div className="px-2 sm:px-4 lg:px-8">
            <div className="space-y-8">
              {/* Wallet Cards */}
              <section>
                <h3 className="text-lg font-semibold text-white mb-4">Your Wallets</h3>
                <StackedCards wallets={sampleWallets} />
              </section>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section>
                  <h3 className="text-lg font-semibold text-white mb-4">Portfolio Value</h3>
                  <PortfolioValueChart 
                    data={historicalData} 
                    currentValue={32863.42}
                    changePercent={4.8}
                    changeValue={1503.21}
                  />
                </section>

                <section>
                  <h3 className="text-lg font-semibold text-white mb-4">Portfolio Breakdown</h3>
                  <PortfolioBreakdown data={breakdownData} totalValue={32763.42} />
                </section>
              </div>

              {/* Top Movers */}
              <section>
                <h3 className="text-lg font-semibold text-white mb-4">Market Movers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TopMovers title="Top Gainers" items={topGainers} type="gainers" />
                  <TopMovers title="Top Losers" items={topLosers} type="losers" />
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export default function IndexPage() {
  const { user } = useLoaderData<typeof loader>();

  if (!user) {
    return <LandingPage />;
  }

  return <Dashboard user={user} />;
}
