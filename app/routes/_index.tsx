import type { LoaderFunctionArgs, MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useFetcher } from "@remix-run/react";
import { Search, Bitcoin, LogOut, RefreshCw, Wallet } from "lucide-react"
import { Card } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Sidebar } from "~/components/layout/sidebar"
import { PortfolioChart } from "~/components/ui/portfolio-chart"
import { TransactionTable } from "~/components/ui/transaction-table"
import { requireAuth } from "~/lib/auth";
import { getUserBalances } from "~/lib/balance.server";
import { maybeRefreshBalances, getRefreshStatus, forceRefreshBalances } from "~/lib/jobs/balance-refresh.server";
import { NETWORK_CONFIG } from "~/lib/blockchain/types";
import type { WalletNetwork } from "~/lib/wallet";

export const meta: MetaFunction = () => {
  return [
    { title: "Pulsar - Crypto Portfolio Tracker" },
    { name: "description", content: "Track your cryptocurrency portfolio with ease" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  // Maybe trigger background refresh
  await maybeRefreshBalances();

  // Get cached balances
  const balances = await getUserBalances(user.id);

  // Get refresh status
  const refreshStatus = await getRefreshStatus();

  return json({ user, balances, refreshStatus });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAuth(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "refresh") {
    await forceRefreshBalances();
    return json({ success: true });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

// Network icon component
function NetworkIcon({ network }: { network: WalletNetwork }) {
  switch (network) {
    case "bitcoin":
      return <Bitcoin className="h-6 w-6" />;
    case "ethereum":
      return (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1.5l-7 10.5 7 4 7-4-7-10.5zM5 13.5l7 9.5 7-9.5-7 4-7-4z" />
        </svg>
      );
    case "solana":
      return (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 18.75l3-3h12l-3 3h-12zM4.5 12.75l3-3h12l-3 3h-12zM4.5 6.75l3-3h12l-3 3h-12z" />
        </svg>
      );
    default:
      return <Wallet className="h-6 w-6" />;
  }
}

// Format a balance for display (split into whole and decimal parts)
function formatBalanceDisplay(amount: string): { whole: string; decimals: string } {
  if (!amount || amount === "0") {
    return { whole: "0", decimals: "" };
  }

  const parts = amount.split(".");
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = parts[1] ? `.${parts[1].slice(0, 4)}` : "";

  return { whole, decimals };
}

export default function Index() {
  const { user, balances, refreshStatus } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const isRefreshing = fetcher.state !== "idle" || refreshStatus.isRefreshing;

  // Format last refresh time
  const lastRefreshText = refreshStatus.lastRefresh
    ? new Date(refreshStatus.lastRefresh).toLocaleString()
    : "Never";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">Welcome back, {user.username}.</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search assets" className="pl-10 bg-secondary/50 border-0 h-11 rounded-xl" />
            </div>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="refresh" />
              <Button
                variant="ghost"
                size="icon"
                type="submit"
                title="Refresh balances"
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </fetcher.Form>
            <Form method="post" action="/auth/logout">
              <Button variant="ghost" size="icon" type="submit" title="Sign out">
                <LogOut className="h-5 w-5" />
              </Button>
            </Form>
          </div>
        </header>

        {/* Portfolio Overview */}
        <Card className="p-6 lg:p-8 mb-6 shadow-sm border-0">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-6">
            <div className="mb-6 lg:mb-0">
              <p className="text-sm text-muted-foreground mb-2">Portfolio</p>
              {balances.length === 0 ? (
                <div className="text-muted-foreground">
                  <p className="text-lg">No wallets added yet</p>
                  <p className="text-sm mt-1">Add a wallet from the Accounts page to start tracking</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mt-1">
                    {balances.length} wallet{balances.length !== 1 ? "s" : ""} tracked
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Last updated: {lastRefreshText}
                  </p>
                </>
              )}
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
            </div>
          </div>

          {/* Chart */}
          <PortfolioChart />
        </Card>

        {/* Wallet Balances */}
        {balances.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {balances.map((balance) => {
              const config = NETWORK_CONFIG[balance.wallet.network];
              const { whole, decimals } = formatBalanceDisplay(
                balance.nativeBalance?.formatted || "0"
              );

              return (
                <Card key={balance.wallet.id} className="p-6 border-0 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/70 flex items-center justify-center text-muted-foreground">
                      <NetworkIcon network={balance.wallet.network} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {balance.wallet.name || `${config.nativeName} Wallet`}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {balance.wallet.address.slice(0, 8)}...{balance.wallet.address.slice(-6)}
                      </p>
                    </div>
                  </div>

                  {/* Native Balance */}
                  <div className="mb-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">{whole}</span>
                      <span className="text-lg text-muted-foreground">{decimals}</span>
                      <span className="text-sm text-muted-foreground ml-1">
                        {balance.nativeBalance?.symbol || config.nativeSymbol}
                      </span>
                    </div>
                  </div>

                  {/* Token Balances */}
                  {balance.tokenBalances.length > 0 && (
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Tokens ({balance.tokenBalances.length})
                      </p>
                      {balance.tokenBalances.slice(0, 3).map((tb: typeof balance.tokenBalances[number], i: number) => {
                        const tbFormatted = formatBalanceDisplay(tb.formatted);
                        return (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{tb.token.symbol}</span>
                            <span className="font-medium">
                              {tbFormatted.whole}{tbFormatted.decimals}
                            </span>
                          </div>
                        );
                      })}
                      {balance.tokenBalances.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{balance.tokenBalances.length - 3} more
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Transactions */}
        <Card className="p-6 lg:p-8 shadow-sm border-0">
          <h3 className="text-xl font-semibold mb-6">Transactions</h3>
          <TransactionTable />
        </Card>
      </main>
    </div>
  )
}
