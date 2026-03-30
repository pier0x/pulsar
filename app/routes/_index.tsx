import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { getCurrentUser } from "~/lib/auth";
import { requireOwnerOrOnboard } from "~/lib/onboard.server";
import { getLastRefreshData } from "~/lib/lastRefresh.server";
import { Logo, Button, Input, FormField, Alert, Card } from "~/components/ui";
import { prisma } from "~/lib/db.server";
import { NETWORK_INFO, EVM_NETWORKS, type WalletNetwork } from "~/lib/wallet";

// Dashboard components
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
import type { LastRefreshData } from "~/components/layout/navbar";
import MobileNav from "~/components/layout/mobile-nav";

export const meta: MetaFunction = () => {
  return [
    { title: "Pulsar - Your Wealth, One Dashboard" },
    { name: "description", content: "Track all your assets in one place." },
  ];
};

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOwnerOrOnboard();
  const user = await getCurrentUser(request);

  if (!user) {
    return json({ user: null, wallets: [], chartData: [], breakdownData: [], gainers: [], losers: [], currentValue: "$0.00", changePercent: 0, lastRefresh: null });
  }

  // Fetch wallets with latest 2 snapshots each (for movers comparison)
  const wallets = await prisma.wallet.findMany({
    where: { userId: user.id },
    include: {
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 2,
        include: { tokenSnapshots: true },
      },
    },
  });

  // --- Build WalletData[] (group EVM wallets by address) ---
  const evmByAddress = new Map<string, typeof wallets>();
  const nonEvmWallets: typeof wallets = [];

  for (const w of wallets) {
    if (EVM_NETWORKS.includes(w.network as WalletNetwork)) {
      const key = w.address.toLowerCase();
      const group = evmByAddress.get(key) || [];
      group.push(w);
      evmByAddress.set(key, group);
    } else {
      nonEvmWallets.push(w);
    }
  }

  const walletCards: WalletData[] = [];

  // Grouped EVM wallets
  for (const [, group] of evmByAddress) {
    const primary = group.find(w => w.network === "ethereum") || group[0];
    const totalUsd = group.reduce((sum, w) => {
      const snap = w.snapshots[0];
      return sum + (snap ? Number(snap.totalUsdValue) : 0);
    }, 0);
    const primarySnap = primary.snapshots[0];
    const nativeInfo = NETWORK_INFO[primary.network as WalletNetwork];
    const nativeBalFormatted = primarySnap
      ? formatNativeBalance(primarySnap.nativeBalance, primary.network as WalletNetwork)
      : `0 ${nativeInfo.symbol}`;

    walletCards.push({
      id: primary.id,
      name: primary.name || "Wallet",
      chain: group.length > 1 ? "Multi-chain" : NETWORK_INFO[primary.network as WalletNetwork].displayName,
      address: primary.address,
      balance: nativeBalFormatted,
      balanceUsd: formatUsd(totalUsd),
    });
  }

  // Non-EVM wallets
  for (const w of nonEvmWallets) {
    const snap = w.snapshots[0];
    const network = w.network as WalletNetwork;
    const info = NETWORK_INFO[network];
    const totalUsd = snap ? Number(snap.totalUsdValue) : 0;
    const nativeBalFormatted = snap
      ? formatNativeBalance(snap.nativeBalance, network)
      : `0 ${info.symbol}`;

    walletCards.push({
      id: w.id,
      name: w.name || "Wallet",
      chain: info.displayName,
      address: w.address,
      balance: nativeBalFormatted,
      balanceUsd: formatUsd(totalUsd),
    });
  }

  // --- Build PortfolioDataPoint[] (aggregate snapshots by day, last 30 days) ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const allSnapshots = await prisma.balanceSnapshot.findMany({
    where: {
      wallet: { userId: user.id },
      timestamp: { gte: thirtyDaysAgo },
    },
    select: { timestamp: true, totalUsdValue: true },
    orderBy: { timestamp: "asc" },
  });

  // Aggregate by date string
  const dailyTotals = new Map<string, number>();
  for (const snap of allSnapshots) {
    const dateKey = snap.timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
    dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + Number(snap.totalUsdValue));
  }

  // For each date, we actually want the latest snapshot per wallet, not sum of all snapshots
  // Let's recompute: group snapshots by (date, walletId), take the latest per wallet per day, then sum
  const snapshotsByDateWallet = new Map<string, Map<string, number>>();
  const allSnapshotsWithWallet = await prisma.balanceSnapshot.findMany({
    where: {
      wallet: { userId: user.id },
      timestamp: { gte: thirtyDaysAgo },
    },
    select: { timestamp: true, totalUsdValue: true, walletId: true },
    orderBy: { timestamp: "asc" },
  });

  for (const snap of allSnapshotsWithWallet) {
    const dateKey = snap.timestamp.toISOString().slice(0, 10);
    if (!snapshotsByDateWallet.has(dateKey)) {
      snapshotsByDateWallet.set(dateKey, new Map());
    }
    // Later snapshot overwrites earlier one for same wallet on same day
    snapshotsByDateWallet.get(dateKey)!.set(snap.walletId, Number(snap.totalUsdValue));
  }

  const chartData: PortfolioDataPoint[] = [];
  const sortedDates = [...snapshotsByDateWallet.keys()].sort();
  for (const dateKey of sortedDates) {
    const walletValues = snapshotsByDateWallet.get(dateKey)!;
    let dayTotal = 0;
    for (const val of walletValues.values()) {
      dayTotal += val;
    }
    const d = new Date(dateKey + "T00:00:00Z");
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    chartData.push({ date: label, value: Math.round(dayTotal * 100) / 100 });
  }

  const lastValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
  const firstValue = chartData.length > 0 ? chartData[0].value : 0;
  const changePercent = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  const currentValue = formatUsd(lastValue);

  // --- Build BreakdownItem[] (aggregate latest snapshots by network) ---
  const networkTotals = new Map<WalletNetwork, number>();
  for (const w of wallets) {
    const snap = w.snapshots[0];
    if (!snap) continue;
    const network = w.network as WalletNetwork;
    networkTotals.set(network, (networkTotals.get(network) || 0) + Number(snap.totalUsdValue));
  }

  const breakdownData: BreakdownItem[] = [];
  for (const [network, value] of networkTotals) {
    if (value <= 0) continue;
    const info = NETWORK_INFO[network];
    breakdownData.push({
      name: info.displayName,
      value: Math.round(value * 100) / 100,
      color: info.color,
    });
  }
  breakdownData.sort((a, b) => b.value - a.value);

  // --- Build TopMovers (compare latest vs previous snapshot per token) ---
  const tokenChanges: MoverItem[] = [];

  for (const w of wallets) {
    const [latest, previous] = w.snapshots;
    if (!latest) continue;

    for (const token of latest.tokenSnapshots) {
      const latestUsd = Number(token.balanceUsd);
      if (latestUsd <= 0) continue;

      let prevUsd = 0;
      if (previous) {
        const prevToken = previous.tokenSnapshots.find(
          t => t.contractAddress.toLowerCase() === token.contractAddress.toLowerCase()
        );
        if (prevToken) {
          prevUsd = Number(prevToken.balanceUsd);
        }
      }

      const change = prevUsd > 0 ? ((latestUsd - prevUsd) / prevUsd) * 100 : 0;
      tokenChanges.push({
        name: token.name || token.symbol,
        symbol: token.symbol,
        changePercent: Math.round(change * 100) / 100,
        value: formatUsd(latestUsd),
      });
    }

    // Also include native token as a mover
    if (latest) {
      const network = w.network as WalletNetwork;
      const info = NETWORK_INFO[network];
      const latestNativeUsd = Number(latest.nativeBalanceUsd);
      if (latestNativeUsd > 0) {
        let prevNativeUsd = 0;
        if (previous) {
          prevNativeUsd = Number(previous.nativeBalanceUsd);
        }
        const change = prevNativeUsd > 0 ? ((latestNativeUsd - prevNativeUsd) / prevNativeUsd) * 100 : 0;
        tokenChanges.push({
          name: info.displayName,
          symbol: info.symbol,
          changePercent: Math.round(change * 100) / 100,
          value: formatUsd(latestNativeUsd),
        });
      }
    }
  }

  // Deduplicate by symbol (keep the one with highest absolute value)
  const bySymbol = new Map<string, MoverItem>();
  for (const item of tokenChanges) {
    const existing = bySymbol.get(item.symbol);
    if (!existing || Math.abs(item.changePercent) > Math.abs(existing.changePercent)) {
      bySymbol.set(item.symbol, item);
    }
  }
  const uniqueMovers = [...bySymbol.values()];

  const gainers = uniqueMovers
    .filter(m => m.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5);

  const losers = uniqueMovers
    .filter(m => m.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 5);

  const lastRefresh = await getLastRefreshData(user.id);

  return json({
    user,
    wallets: walletCards,
    chartData,
    breakdownData,
    gainers,
    losers,
    currentValue,
    changePercent: Math.round(changePercent * 100) / 100,
    lastRefresh,
  });
}

/**
 * Format native balance from raw (wei/sats/lamports) to human-readable with symbol
 */
function formatNativeBalance(rawBalance: string, network: WalletNetwork): string {
  const info = NETWORK_INFO[network];
  let decimals: number;
  switch (network) {
    case "bitcoin":
      decimals = 8;
      break;
    case "solana":
      decimals = 9;
      break;
    default:
      decimals = 18; // EVM
  }

  try {
    const balance = BigInt(rawBalance);
    const divisor = BigInt(10 ** decimals);
    const intPart = balance / divisor;
    const fracPart = balance % divisor;
    const fracStr = fracPart.toString().padStart(decimals, "0").slice(0, 4);
    return `${intPart}.${fracStr} ${info.symbol}`;
  } catch {
    return `0 ${info.symbol}`;
  }
}

// --- Login page ---

function LoginPage() {
  const fetcher = useFetcher<{ error?: string }>();
  const isSubmitting = fetcher.state === "submitting";
  const error = fetcher.data?.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <Card className="p-6">
          {error && <Alert variant="error" className="mb-5">{error}</Alert>}

          <fetcher.Form method="post" action="/auth/login" className="space-y-4">
            <input type="hidden" name="redirectTo" value="/" />

            <FormField label="Username" htmlFor="username">
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
              />
            </FormField>

            <FormField label="Password" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </FormField>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </fetcher.Form>
        </Card>
      </div>
    </div>
  );
}

// --- Dashboard ---

function Dashboard({ user, wallets, chartData, breakdownData, gainers, losers, currentValue, changePercent, lastRefresh }: {
  user: { id: string; username: string; avatarUrl: string | null };
  wallets: WalletData[];
  chartData: PortfolioDataPoint[];
  breakdownData: BreakdownItem[];
  gainers: MoverItem[];
  losers: MoverItem[];
  currentValue: string;
  changePercent: number;
  lastRefresh: LastRefreshData | null;
}) {
  return (
    <div className="relative h-screen p-2 sm:p-4 flex w-full flex-row overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="shrink-0 pt-4 lg:pt-10">
          <Navbar user={user} lastRefresh={lastRefresh} />
        </div>
        <main className="flex-1 overflow-y-auto py-4 lg:py-10 pb-24 lg:pb-10">
          <div className="px-2 sm:px-4 lg:px-8">
            <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-6 w-full">
              <div className="col-span-1 md:col-span-2 lg:col-span-4 min-h-[280px] sm:min-h-[320px] lg:min-h-[360px]">
                <PortfolioValueChart
                  data={chartData}
                  currentValue={currentValue}
                  changePercent={changePercent}
                />
              </div>
              <div className="col-span-1 md:col-span-2 lg:col-span-2 min-h-[320px] lg:min-h-[360px]">
                <StackedCards wallets={wallets} />
              </div>
              <div className="col-span-1 md:col-span-2 lg:col-span-2">
                <PortfolioBreakdown data={breakdownData} />
              </div>
              <div className="col-span-1 lg:col-span-2">
                <TopMovers title="Top Gainers" items={gainers} type="gainers" />
              </div>
              <div className="col-span-1 lg:col-span-2">
                <TopMovers title="Top Losers" items={losers} type="losers" />
              </div>
            </div>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

// --- Root ---

export default function IndexPage() {
  const { user, wallets, chartData, breakdownData, gainers, losers, currentValue, changePercent, lastRefresh } = useLoaderData<typeof loader>();

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Dashboard
      user={user}
      wallets={wallets}
      chartData={chartData}
      breakdownData={breakdownData}
      gainers={gainers}
      losers={losers}
      currentValue={currentValue}
      changePercent={changePercent}
      lastRefresh={lastRefresh}
    />
  );
}
