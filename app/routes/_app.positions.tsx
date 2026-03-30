import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useFetcher } from "@remix-run/react";
import { Plus, Trash2, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Button,
  Input,
  FormField,
  Alert,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "~/components/ui";
import { requireAuth } from "~/lib/auth";
import { prisma } from "~/lib/db.server";
import { getCoinGeckoApiKey } from "~/lib/settings.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Positions - Pulsar" },
    { name: "description", content: "Track your cost basis and P&L" },
  ];
};

// CoinGecko asset ID mapping
const ASSET_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  POL: "polygon-ecosystem-token",
  MATIC: "polygon-ecosystem-token",
  ARB: "arbitrum",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  OP: "optimism",
  AVAX: "avalanche-2",
  DOGE: "dogecoin",
  ADA: "cardano",
  DOT: "polkadot",
  ATOM: "cosmos",
  NEAR: "near",
  HYPE: "hyperliquid",
};

function getCoingeckoId(asset: string): string {
  return ASSET_TO_COINGECKO[asset.toUpperCase()] || asset.toLowerCase();
}

/**
 * Fetch fresh prices from CoinGecko and cache them in DB.
 */
async function refreshPrices(assets: string[], apiKey: string | null): Promise<Record<string, number | null>> {
  if (assets.length === 0) return {};

  const { coingeckoFetch } = await import("~/lib/providers/coingecko.server");
  const ids = [...new Set(assets.map(getCoingeckoId))];
  const idsParam = ids.join(",");
  const result: Record<string, number | null> = {};

  try {
    const data = (await coingeckoFetch(
      `/simple/price?ids=${idsParam}&vs_currencies=usd`,
      apiKey
    )) as Record<string, { usd?: number }>;

    for (const asset of assets) {
      const cgId = getCoingeckoId(asset);
      const price = data[cgId]?.usd ?? null;
      result[asset] = price;

      if (price !== null) {
        await prisma.assetPrice.upsert({
          where: { asset },
          update: { priceUsd: price },
          create: { asset, priceUsd: price },
        });
      }
    }
  } catch {
    return Object.fromEntries(assets.map((a) => [a, null]));
  }

  return result;
}

/**
 * Read cached prices from DB.
 */
async function getCachedPrices(assets: string[]): Promise<Record<string, { price: number; updatedAt: Date } | null>> {
  if (assets.length === 0) return {};

  const cached = await prisma.assetPrice.findMany({
    where: { asset: { in: assets } },
  });

  const result: Record<string, { price: number; updatedAt: Date } | null> = {};
  const cachedMap = new Map(cached.map((c) => [c.asset, c]));

  for (const asset of assets) {
    const entry = cachedMap.get(asset);
    result[asset] = entry ? { price: Number(entry.priceUsd), updatedAt: entry.updatedAt } : null;
  }

  return result;
}

interface AssetSummary {
  asset: string;
  totalAmount: number;
  totalCost: number;
  avgEntry: number;
  currentPrice: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  currentValue: number | null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  const positions = await prisma.position.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });

  // Group by asset
  const assetGroups = new Map<
    string,
    { totalAmount: number; totalCost: number }
  >();
  for (const pos of positions) {
    const existing = assetGroups.get(pos.asset) || {
      totalAmount: 0,
      totalCost: 0,
    };
    const amount = Number(pos.amount);
    const price = Number(pos.priceUsd);
    existing.totalAmount += amount;
    existing.totalCost += amount * price;
    assetGroups.set(pos.asset, existing);
  }

  const uniqueAssets = [...assetGroups.keys()];
  const cachedPrices = await getCachedPrices(uniqueAssets);

  // Find the most recent price update time
  let lastPriceUpdate: string | null = null;
  for (const entry of Object.values(cachedPrices)) {
    if (entry && (!lastPriceUpdate || entry.updatedAt.toISOString() > lastPriceUpdate)) {
      lastPriceUpdate = entry.updatedAt.toISOString();
    }
  }

  const summaries: AssetSummary[] = uniqueAssets.map((asset) => {
    const group = assetGroups.get(asset)!;
    const avgEntry =
      group.totalAmount > 0 ? group.totalCost / group.totalAmount : 0;
    const cached = cachedPrices[asset];
    const currentPrice = cached?.price ?? null;
    const pnl =
      currentPrice !== null
        ? (currentPrice - avgEntry) * group.totalAmount
        : null;
    const pnlPercent =
      pnl !== null && group.totalCost > 0
        ? (pnl / group.totalCost) * 100
        : null;
    const currentValue =
      currentPrice !== null ? currentPrice * group.totalAmount : null;

    return {
      asset,
      totalAmount: group.totalAmount,
      totalCost: group.totalCost,
      avgEntry,
      currentPrice,
      pnl,
      pnlPercent,
      currentValue,
    };
  });

  // Sort summaries by total cost desc
  summaries.sort((a, b) => b.totalCost - a.totalCost);

  // Serialize positions for the client
  const serializedPositions = positions.map((p) => ({
    id: p.id,
    asset: p.asset,
    type: p.type,
    amount: Number(p.amount),
    priceUsd: Number(p.priceUsd),
    date: p.date.toISOString(),
    note: p.note,
    createdAt: p.createdAt.toISOString(),
  }));

  return json({ positions: serializedPositions, summaries, lastPriceUpdate });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "add") {
    const asset = formData.get("asset");
    const amount = formData.get("amount");
    const priceUsd = formData.get("priceUsd");
    const date = formData.get("date");
    const note = formData.get("note");

    if (typeof asset !== "string" || !asset.trim()) {
      return json({ error: "Asset is required" }, { status: 400 });
    }
    if (typeof amount !== "string" || !amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      return json({ error: "Valid amount is required" }, { status: 400 });
    }
    if (typeof priceUsd !== "string" || !priceUsd.trim() || isNaN(Number(priceUsd)) || Number(priceUsd) <= 0) {
      return json({ error: "Valid price is required" }, { status: 400 });
    }
    if (typeof date !== "string" || !date.trim()) {
      return json({ error: "Date is required" }, { status: 400 });
    }

    await prisma.position.create({
      data: {
        userId: user.id,
        asset: asset.trim().toUpperCase(),
        amount: Number(amount),
        priceUsd: Number(priceUsd),
        date: new Date(date),
        note: typeof note === "string" && note.trim() ? note.trim() : null,
      },
    });

    return json({ success: true });
  }

  if (intent === "refreshPrices") {
    const positions = await prisma.position.findMany({
      where: { userId: user.id },
      select: { asset: true },
      distinct: ["asset"],
    });
    const assets = positions.map((p) => p.asset);
    const apiKey = await getCoinGeckoApiKey(user.id);
    await refreshPrices(assets, apiKey);
    return json({ success: true, intent: "refreshPrices" });
  }

  if (intent === "delete") {
    const id = formData.get("id");
    if (typeof id !== "string") {
      return json({ error: "Invalid position ID" }, { status: 400 });
    }

    // Verify ownership
    const position = await prisma.position.findFirst({
      where: { id, userId: user.id },
    });

    if (!position) {
      return json({ error: "Position not found" }, { status: 404 });
    }

    await prisma.position.delete({ where: { id } });
    return json({ success: true });
  }

  return json({ error: "Invalid intent" }, { status: 400 });
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, decimals = 6): string {
  // Trim trailing zeros
  const formatted = value.toFixed(decimals);
  return formatted.replace(/\.?0+$/, "") || "0";
}

// Asset color mapping for badges
const ASSET_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#9945ff",
  MATIC: "#8247e5",
  POL: "#8247e5",
  ARB: "#28a0f0",
  LINK: "#2a5ada",
  UNI: "#ff007a",
  AAVE: "#b6509e",
  OP: "#ff0420",
  AVAX: "#e84142",
  DOGE: "#c2a633",
  ADA: "#0033ad",
  DOT: "#e6007a",
  ATOM: "#2e3148",
  NEAR: "#00c08b",
  HYPE: "#00ff88",
};

function AssetBadge({ asset }: { asset: string }) {
  const color = ASSET_COLORS[asset] || "#71717a";
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full border font-medium"
      style={{
        backgroundColor: `${color}15`,
        color: color,
        borderColor: `${color}30`,
      }}
    >
      {asset}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function Positions() {
  const { positions, summaries, lastPriceUpdate } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showForm, setShowForm] = useState(false);
  const priceFetcher = useFetcher();
  const isRefreshingPrices = priceFetcher.state !== "idle";

  const today = new Date().toISOString().split("T")[0];

  const hasPrices = summaries.some((s) => s.currentPrice !== null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Positions</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-zinc-400 text-sm">
              Track your cost basis and P&L
            </p>
            {lastPriceUpdate && (
              <span className="text-zinc-500 text-xs">
                Prices: {timeAgo(lastPriceUpdate)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summaries.length > 0 && (
            <priceFetcher.Form method="post">
              <input type="hidden" name="intent" value="refreshPrices" />
              <Button
                type="submit"
                variant="secondary"
                disabled={isRefreshingPrices}
                className="cursor-pointer"
              >
                <RefreshCw className={`size-4 ${isRefreshingPrices ? "animate-spin" : ""}`} />
                {isRefreshingPrices ? "Refreshing…" : "Refresh Prices"}
              </Button>
            </priceFetcher.Form>
          )}
          <Button
            onClick={() => setShowForm(!showForm)}
            className="cursor-pointer"
          >
            <Plus className="size-4" />
            Add Buy
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {actionData && "error" in actionData && (
        <Alert variant="destructive">{actionData.error}</Alert>
      )}

      {/* Add Transaction Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Transaction</CardTitle>
                <CardDescription>
                  Record a new buy to track your cost basis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="add" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField label="Asset" htmlFor="asset">
                      <Input
                        id="asset"
                        name="asset"
                        placeholder="BTC"
                        required
                        className="uppercase"
                        style={{ textTransform: "uppercase" }}
                      />
                    </FormField>
                    <FormField label="Amount" htmlFor="amount">
                      <Input
                        id="amount"
                        name="amount"
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.5"
                        required
                      />
                    </FormField>
                    <FormField label="Price per Unit (USD)" htmlFor="priceUsd">
                      <Input
                        id="priceUsd"
                        name="priceUsd"
                        type="number"
                        step="any"
                        min="0"
                        placeholder="60000"
                        required
                      />
                    </FormField>
                    <FormField label="Date" htmlFor="date">
                      <Input
                        id="date"
                        name="date"
                        type="date"
                        defaultValue={today}
                        required
                      />
                    </FormField>
                  </div>
                  <FormField label="Note (optional)" htmlFor="note">
                    <Input
                      id="note"
                      name="note"
                      placeholder="DCA buy, dip buy, etc."
                    />
                  </FormField>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                      {isSubmitting ? "Adding..." : "Add Position"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowForm(false)}
                      className="cursor-pointer"
                    >
                      Cancel
                    </Button>
                  </div>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {summaries.map((summary) => {
            const isProfit = summary.pnl !== null && summary.pnl >= 0;
            return (
              <Card key={summary.asset}>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <AssetBadge asset={summary.asset} />
                    {summary.pnl !== null && (
                      <div className="flex items-center gap-1">
                        {isProfit ? (
                          <TrendingUp className="size-4 text-emerald-400" />
                        ) : (
                          <TrendingDown className="size-4 text-red-400" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            isProfit ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {isProfit ? "+" : ""}
                          {summary.pnlPercent?.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-zinc-500 text-xs">Holdings</p>
                    <p className="text-white font-semibold">
                      {formatNumber(summary.totalAmount)} {summary.asset}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-zinc-500 text-xs">Avg Entry</p>
                      <p className="text-white text-sm font-medium">
                        {formatUsd(summary.avgEntry)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Current</p>
                      <p className="text-white text-sm font-medium">
                        {summary.currentPrice !== null
                          ? formatUsd(summary.currentPrice)
                          : isRefreshingPrices
                          ? <span className="text-zinc-500 animate-pulse">Loading…</span>
                          : <span className="text-zinc-500">—</span>}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-zinc-500 text-xs">Total Invested</p>
                      <p className="text-white text-sm font-medium">
                        {formatUsd(summary.totalCost)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Current Value</p>
                      <p className="text-white text-sm font-medium">
                        {summary.currentValue !== null
                          ? formatUsd(summary.currentValue)
                          : isRefreshingPrices
                          ? <span className="text-zinc-500 animate-pulse">Loading…</span>
                          : <span className="text-zinc-500">—</span>}
                      </p>
                    </div>
                  </div>

                  {summary.pnl !== null && (
                    <div className="pt-2 border-t border-zinc-800">
                      <p className="text-zinc-500 text-xs">P&L</p>
                      <p
                        className={`text-lg font-bold ${
                          isProfit ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {isProfit ? "+" : ""}
                        {formatUsd(summary.pnl)} ({isProfit ? "+" : ""}
                        {summary.pnlPercent?.toFixed(1)}%)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {summaries.length === 0 && !showForm && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="size-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              No positions yet
            </h3>
            <p className="text-zinc-400 text-sm mb-4 max-w-sm">
              Start tracking your cost basis by adding your first buy position.
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="cursor-pointer"
            >
              <Plus className="size-4" />
              Add Your First Position
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      {positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transaction History</CardTitle>
            <CardDescription>
              All your recorded buys
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Asset</th>
                    <th className="pb-3 pr-4 text-right">Amount</th>
                    <th className="pb-3 pr-4 text-right">Price</th>
                    <th className="pb-3 pr-4 text-right">Total Cost</th>
                    <th className="pb-3 pr-4">Note</th>
                    <th className="pb-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {positions.map((pos) => {
                    const totalCost = pos.amount * pos.priceUsd;
                    const dateStr = new Date(pos.date).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    );
                    return (
                      <tr key={pos.id} className="text-sm">
                        <td className="py-3 pr-4 text-zinc-400">{dateStr}</td>
                        <td className="py-3 pr-4">
                          <AssetBadge asset={pos.asset} />
                        </td>
                        <td className="py-3 pr-4 text-right text-white font-medium">
                          {formatNumber(pos.amount)}
                        </td>
                        <td className="py-3 pr-4 text-right text-zinc-300">
                          {formatUsd(pos.priceUsd)}
                        </td>
                        <td className="py-3 pr-4 text-right text-white font-medium">
                          {formatUsd(totalCost)}
                        </td>
                        <td className="py-3 pr-4 text-zinc-500 max-w-[200px] truncate">
                          {pos.note || "—"}
                        </td>
                        <td className="py-3">
                          <Form method="post">
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="id" value={pos.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon-sm"
                              className="cursor-pointer text-zinc-500 hover:text-red-400"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </Form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
