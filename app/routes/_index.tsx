import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams, Link } from "@remix-run/react";
import { getCurrentUser } from "~/lib/auth";
import { requireOwnerOrOnboard } from "~/lib/onboard.server";
import { getLastRefreshData } from "~/lib/lastRefresh.server";
import { Logo, Button, Input, FormField, Alert, Card } from "~/components/ui";
import { prisma } from "~/lib/db.server";
import { NETWORK_INFO, EVM_NETWORKS, type WalletNetwork } from "~/lib/wallet";
import { motion } from "framer-motion";

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

type FilterType = "all" | "onchain" | "bank" | "brokerage" | "manual";

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOwnerOrOnboard();
  const user = await getCurrentUser(request);

  if (!user) {
    return json({ user: null, wallets: [], chartData: [], breakdownData: [], gainers: [], losers: [], currentValue: "$0.00", changePercent: 0, lastRefresh: null, activeFilter: "all" as FilterType });
  }

  const url = new URL(request.url);
  const filterParam = url.searchParams.get("filter");
  const activeFilter: FilterType =
    filterParam === "onchain" || filterParam === "bank" || filterParam === "brokerage" || filterParam === "manual"
      ? filterParam
      : "all";

  const showOnchain = activeFilter === "all" || activeFilter === "onchain";
  const showBank = activeFilter === "all" || activeFilter === "bank";
  const showBrokerage = activeFilter === "all" || activeFilter === "brokerage";
  const showManual = activeFilter === "all" || activeFilter === "manual";

  // Fetch on-chain accounts
  const onchainAccounts = showOnchain
    ? await prisma.account.findMany({
        where: { userId: user.id, type: "onchain" },
        include: {
          snapshots: {
            orderBy: { timestamp: "desc" },
            take: 2,
            include: { tokenSnapshots: true },
          },
        },
      })
    : [];

  // Fetch bank accounts
  const bankAccounts = showBank
    ? await prisma.account.findMany({
        where: { userId: user.id, type: "bank", provider: "simplefin" },
        include: {
          snapshots: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          simplefinConnection: {
            select: { label: true },
          },
        },
      })
    : [];

  // Fetch brokerage accounts
  const brokerageAccounts = showBrokerage
    ? await prisma.account.findMany({
        where: { userId: user.id, type: "brokerage", provider: "simplefin" },
        include: {
          snapshots: {
            orderBy: { timestamp: "desc" },
            take: 2,
            include: { holdings: true },
          },
          simplefinConnection: {
            select: { label: true },
          },
        },
      })
    : [];

  // Fetch manual (physical) assets
  const manualAccounts = showManual
    ? await prisma.account.findMany({
        where: { userId: user.id, type: "manual" },
        include: {
          snapshots: {
            orderBy: { timestamp: "desc" },
            take: 2,
          },
        },
      })
    : [];

  // --- Build WalletData[] ---

  const walletCards: WalletData[] = [];

  // Group EVM accounts by address
  const evmByAddress = new Map<string, typeof onchainAccounts>();
  const nonEvmAccounts: typeof onchainAccounts = [];

  for (const a of onchainAccounts) {
    if (!a.network || !a.address) continue;
    if (EVM_NETWORKS.includes(a.network as WalletNetwork)) {
      const key = a.address.toLowerCase();
      const group = evmByAddress.get(key) || [];
      group.push(a);
      evmByAddress.set(key, group);
    } else {
      nonEvmAccounts.push(a);
    }
  }

  // Grouped EVM accounts
  for (const [, group] of evmByAddress) {
    const primary = group.find((a) => a.network === "ethereum") || group[0];
    const totalUsd = group.reduce((sum, a) => {
      const snap = a.snapshots[0];
      return sum + (snap ? Number(snap.totalUsdValue) : 0);
    }, 0);
    const primarySnap = primary.snapshots[0];
    const nativeInfo = NETWORK_INFO[primary.network as WalletNetwork];
    const nativeBalFormatted = primarySnap
      ? formatNativeBalance(primarySnap.nativeBalance, primary.network as WalletNetwork)
      : `0 ${nativeInfo?.symbol || "ETH"}`;

    walletCards.push({
      id: primary.id,
      name: primary.name || "Wallet",
      chain: group.length > 1 ? "Multi-chain" : NETWORK_INFO[primary.network as WalletNetwork]?.displayName || primary.network || "Unknown",
      address: primary.address || "",
      balance: nativeBalFormatted,
      balanceUsd: formatUsd(totalUsd),
    });
  }

  // Non-EVM accounts
  for (const a of nonEvmAccounts) {
    if (!a.network || !a.address) continue;
    const snap = a.snapshots[0];
    const network = a.network as WalletNetwork;
    const info = NETWORK_INFO[network];
    const totalUsd = snap ? Number(snap.totalUsdValue) : 0;
    const nativeBalFormatted = snap
      ? formatNativeBalance(snap.nativeBalance, network)
      : `0 ${info?.symbol || ""}`;

    walletCards.push({
      id: a.id,
      name: a.name || "Wallet",
      chain: info?.displayName || network,
      address: a.address,
      balance: nativeBalFormatted,
      balanceUsd: formatUsd(totalUsd),
    });
  }

  // Bank account cards
  for (const a of bankAccounts) {
    const snap = a.snapshots[0];
    const totalUsd = snap ? Number(snap.totalUsdValue) : 0;
    const institution =
      a.simplefinConnection?.label ||
      "Bank";

    walletCards.push({
      id: a.id,
      name: a.name || institution,
      chain: "Bank Account",
      address: "",
      balance: institution,
      balanceUsd: formatUsd(totalUsd),
    });
  }

  // Brokerage account cards
  for (const a of brokerageAccounts) {
    const snap = a.snapshots[0];
    const totalUsd = snap ? Number(snap.totalUsdValue) : 0;
    const holdingsValue = snap?.holdingsValue ? Number(snap.holdingsValue) : totalUsd;
    const institution =
      a.simplefinConnection?.label ||
      "Brokerage";
    const subtype = "Brokerage";

    // Top holdings preview
    const topHoldings = snap?.holdings
      ?.sort((a, b) => Number(b.valueUsd) - Number(a.valueUsd))
      .slice(0, 3)
      .map((h) => h.ticker)
      .join(", ") || "";

    walletCards.push({
      id: a.id,
      name: a.name || institution,
      chain: subtype,
      address: topHoldings ? `${topHoldings}...` : "",
      balance: `${formatUsd(holdingsValue)} holdings`,
      balanceUsd: formatUsd(totalUsd),
    });
  }

  // Manual asset cards
  for (const a of manualAccounts) {
    const snap = a.snapshots[0];
    const totalUsd = snap ? Number(snap.totalUsdValue) : 0;
    const category = a.category
      ? a.category.charAt(0).toUpperCase() + a.category.slice(1)
      : "Physical Asset";

    walletCards.push({
      id: a.id,
      name: a.name,
      chain: category,
      address: a.imagePath ? `/api/asset-image/${a.id}` : "",
      balance: category,
      balanceUsd: formatUsd(totalUsd),
    });
  }

  // --- Build PortfolioDataPoint[] (aggregate snapshots by day, last 30 days) ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const accountIds = [
    ...onchainAccounts.map((a) => a.id),
    ...bankAccounts.map((a) => a.id),
    ...brokerageAccounts.map((a) => a.id),
    ...manualAccounts.map((a) => a.id),
  ];

  const snapshotsByDateAccount = new Map<string, Map<string, number>>();

  if (accountIds.length > 0) {
    const allSnapshots = await prisma.accountSnapshot.findMany({
      where: {
        accountId: { in: accountIds },
        timestamp: { gte: thirtyDaysAgo },
      },
      select: { timestamp: true, totalUsdValue: true, accountId: true },
      orderBy: { timestamp: "asc" },
    });

    for (const snap of allSnapshots) {
      const dateKey = snap.timestamp.toISOString().slice(0, 10);
      if (!snapshotsByDateAccount.has(dateKey)) {
        snapshotsByDateAccount.set(dateKey, new Map());
      }
      snapshotsByDateAccount.get(dateKey)!.set(snap.accountId, Number(snap.totalUsdValue));
    }
  }

  const chartData: PortfolioDataPoint[] = [];
  const sortedDates = [...snapshotsByDateAccount.keys()].sort();
  for (const dateKey of sortedDates) {
    const accountValues = snapshotsByDateAccount.get(dateKey)!;
    let dayTotal = 0;
    for (const val of accountValues.values()) {
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

  // --- Build BreakdownItem[] (category-aware) ---
  const breakdownData: BreakdownItem[] = [];

  // On-chain: breakdown by network
  if (showOnchain) {
    const networkTotals = new Map<string, number>();
    for (const a of onchainAccounts) {
      const snap = a.snapshots[0];
      if (!snap || !a.network) continue;
      const network = a.network as WalletNetwork;
      networkTotals.set(network, (networkTotals.get(network) || 0) + Number(snap.totalUsdValue));
    }
    for (const [network, value] of networkTotals) {
      if (value <= 0) continue;
      const info = NETWORK_INFO[network as WalletNetwork];
      if (!info) continue;
      breakdownData.push({
        name: info.displayName,
        value: Math.round(value * 100) / 100,
        color: info.color,
      });
    }
  }

  // Bank: breakdown by institution
  if (showBank) {
    const bankTotals = new Map<string, number>();
    for (const a of bankAccounts) {
      const snap = a.snapshots[0];
      if (!snap) continue;
      const institution =
        a.simplefinConnection?.label ||
        a.name ||
        "Bank";
      bankTotals.set(institution, (bankTotals.get(institution) || 0) + Number(snap.totalUsdValue));
    }
    // Cycle through emerald shades for each institution
    const bankColors = ["#34d399", "#10b981", "#059669", "#047857"];
    let bankIdx = 0;
    for (const [institution, value] of bankTotals) {
      if (value <= 0) continue;
      breakdownData.push({
        name: institution,
        value: Math.round(value * 100) / 100,
        color: bankColors[bankIdx % bankColors.length],
      });
      bankIdx++;
    }
  }

  // Brokerage: breakdown by institution
  if (showBrokerage) {
    const brokerageTotals = new Map<string, number>();
    for (const a of brokerageAccounts) {
      const snap = a.snapshots[0];
      if (!snap) continue;
      const institution =
        a.simplefinConnection?.label ||
        a.name ||
        "Brokerage";
      brokerageTotals.set(institution, (brokerageTotals.get(institution) || 0) + Number(snap.totalUsdValue));
    }
    const brokerageColors = ["#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9"];
    let brokerageIdx = 0;
    for (const [institution, value] of brokerageTotals) {
      if (value <= 0) continue;
      breakdownData.push({
        name: institution,
        value: Math.round(value * 100) / 100,
        color: brokerageColors[brokerageIdx % brokerageColors.length],
      });
      brokerageIdx++;
    }
  }

  // Manual assets: breakdown by category
  if (showManual) {
    const manualCategoryTotals = new Map<string, number>();
    for (const a of manualAccounts) {
      const snap = a.snapshots[0];
      if (!snap) continue;
      const cat = a.category
        ? a.category.charAt(0).toUpperCase() + a.category.slice(1)
        : "Physical Assets";
      manualCategoryTotals.set(cat, (manualCategoryTotals.get(cat) || 0) + Number(snap.totalUsdValue));
    }
    const manualColors = ["#fb923c", "#f97316", "#ea580c", "#c2410c"];
    let manualIdx = 0;
    for (const [cat, value] of manualCategoryTotals) {
      if (value <= 0) continue;
      breakdownData.push({
        name: cat,
        value: Math.round(value * 100) / 100,
        color: manualColors[manualIdx % manualColors.length],
      });
      manualIdx++;
    }
  }

  breakdownData.sort((a, b) => b.value - a.value);

  // --- Build TopMovers ---
  const tokenChanges: MoverItem[] = [];

  // On-chain token movers
  if (showOnchain) {
    for (const a of onchainAccounts) {
      const [latest, previous] = a.snapshots;
      if (!latest) continue;

      for (const token of latest.tokenSnapshots) {
        const latestUsd = Number(token.balanceUsd);
        if (latestUsd <= 0) continue;

        let prevUsd = 0;
        if (previous) {
          const prevToken = previous.tokenSnapshots.find(
            (t) => t.contractAddress.toLowerCase() === token.contractAddress.toLowerCase()
          );
          if (prevToken) prevUsd = Number(prevToken.balanceUsd);
        }

        const change = prevUsd > 0 ? ((latestUsd - prevUsd) / prevUsd) * 100 : 0;
        tokenChanges.push({
          name: token.name || token.symbol,
          symbol: token.symbol,
          changePercent: Math.round(change * 100) / 100,
          value: formatUsd(latestUsd),
        });
      }

      // Native token as a mover
      if (latest && a.network) {
        const network = a.network as WalletNetwork;
        const info = NETWORK_INFO[network];
        if (info) {
          const latestNativeUsd = Number(latest.nativeBalanceUsd);
          if (latestNativeUsd > 0) {
            const prevNativeUsd = previous ? Number(previous.nativeBalanceUsd) : 0;
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
    }
  }

  // Brokerage stock movers
  if (showBrokerage) {
    for (const a of brokerageAccounts) {
      const [latest, previous] = a.snapshots;
      if (!latest?.holdings) continue;

      for (const holding of latest.holdings) {
        const latestUsd = Number(holding.valueUsd);
        if (latestUsd <= 0) continue;

        let prevUsd = 0;
        if (previous?.holdings) {
          const prevHolding = previous.holdings.find(
            (h) => h.ticker === holding.ticker
          );
          if (prevHolding) prevUsd = Number(prevHolding.valueUsd);
        }

        // Only include if we have a previous snapshot to compare
        if (prevUsd <= 0) continue;
        const change = ((latestUsd - prevUsd) / prevUsd) * 100;
        tokenChanges.push({
          name: holding.name || holding.ticker,
          symbol: holding.ticker,
          changePercent: Math.round(change * 100) / 100,
          value: formatUsd(latestUsd),
        });
      }
    }
  }

  // Manual asset movers
  if (showManual) {
    for (const a of manualAccounts) {
      const [latest, previous] = a.snapshots;
      if (!latest) continue;
      const latestUsd = Number(latest.totalUsdValue);
      if (latestUsd <= 0) continue;
      if (!previous) continue;

      const prevUsd = Number(previous.totalUsdValue);
      if (prevUsd <= 0) continue;

      const change = ((latestUsd - prevUsd) / prevUsd) * 100;
      tokenChanges.push({
        name: a.name,
        symbol: a.category ? a.category.toUpperCase().slice(0, 6) : a.id.slice(0, 6),
        changePercent: Math.round(change * 100) / 100,
        value: formatUsd(latestUsd),
      });
    }
  }

  // Deduplicate by symbol (keep highest absolute change)
  const bySymbol = new Map<string, MoverItem>();
  for (const item of tokenChanges) {
    const existing = bySymbol.get(item.symbol);
    if (!existing || Math.abs(item.changePercent) > Math.abs(existing.changePercent)) {
      bySymbol.set(item.symbol, item);
    }
  }
  const uniqueMovers = [...bySymbol.values()];

  const gainers = uniqueMovers
    .filter((m) => m.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5);

  const losers = uniqueMovers
    .filter((m) => m.changePercent < 0)
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
    activeFilter,
  });
}

/**
 * Format native balance from raw (wei/sats/lamports) to human-readable with symbol
 */
function formatNativeBalance(rawBalance: string | null, network: WalletNetwork): string {
  if (!rawBalance) return `0 ${NETWORK_INFO[network]?.symbol || ""}`;
  const info = NETWORK_INFO[network];

  if (network === "hyperliquid") {
    try {
      const usd = parseInt(rawBalance, 10) / 1e6;
      return `${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${info?.symbol || "USDC"}`;
    } catch {
      return `0 ${info?.symbol || "USDC"}`;
    }
  }

  let decimals: number;
  switch (network) {
    case "bitcoin":
      decimals = 8;
      break;
    case "solana":
      decimals = 9;
      break;
    default:
      decimals = 18;
  }

  try {
    const balance = BigInt(rawBalance);
    const divisor = BigInt(10 ** decimals);
    const intPart = balance / divisor;
    const fracPart = balance % divisor;
    const fracStr = fracPart.toString().padStart(decimals, "0").slice(0, 4);
    return `${intPart}.${fracStr} ${info?.symbol || ""}`;
  } catch {
    return `0 ${info?.symbol || ""}`;
  }
}

// --- Login page ---

function LoginPage() {
  const fetcher = useFetcher<{ error?: string }>();
  const isSubmitting = fetcher.state === "submitting";
  const error = fetcher.data?.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
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

// --- Filter bar ---

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "onchain", label: "On-chain" },
  { id: "bank", label: "Banking" },
  { id: "brokerage", label: "Investments" },
  { id: "manual", label: "Assets" },
];

function FilterBar({ activeFilter }: { activeFilter: FilterType }) {
  const [searchParams] = useSearchParams();

  const filterLink = (filter: FilterType) => {
    const params = new URLSearchParams(searchParams);
    if (filter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", filter);
    }
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2 flex-wrap"
    >
      {FILTERS.map((f) => {
        const isActive = f.id === activeFilter;
        return (
          <Link
            key={f.id}
            to={filterLink(f.id)}
            prefetch="intent"
            className={[
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer",
              isActive
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
            ].join(" ")}
          >
            {f.label}
          </Link>
        );
      })}
    </motion.div>
  );
}

// --- Dashboard ---

function Dashboard({
  user,
  wallets,
  chartData,
  breakdownData,
  gainers,
  losers,
  currentValue,
  changePercent,
  lastRefresh,
  activeFilter,
}: {
  user: { id: string; username: string; avatarUrl: string | null };
  wallets: WalletData[];
  chartData: PortfolioDataPoint[];
  breakdownData: BreakdownItem[];
  gainers: MoverItem[];
  losers: MoverItem[];
  currentValue: string;
  changePercent: number;
  lastRefresh: LastRefreshData | null;
  activeFilter: FilterType;
}) {
  return (
    <div className="relative h-screen p-2 sm:p-4 flex w-full flex-row overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="shrink-0 pt-4 lg:pt-10">
          <Navbar user={user} lastRefresh={lastRefresh} />
        </div>
        <main className="flex-1 overflow-y-auto py-4 lg:py-6 pb-24 lg:pb-10">
          <div className="px-2 sm:px-4 lg:px-8">
            {/* Filter bar */}
            <div className="mb-4 sm:mb-5">
              <FilterBar activeFilter={activeFilter} />
            </div>

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
  const { user, wallets, chartData, breakdownData, gainers, losers, currentValue, changePercent, lastRefresh, activeFilter } = useLoaderData<typeof loader>();

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
      activeFilter={activeFilter as FilterType}
    />
  );
}
