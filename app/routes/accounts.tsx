import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Plus, Trash2, Wallet, Bitcoin, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Sidebar } from "~/components/layout/sidebar";
import { requireAuth } from "~/lib/auth";
import { prisma } from "~/lib/db.server";
import { detectWalletNetwork } from "~/lib/wallet.server";
import { formatAddress, getNetworkDisplayName, type WalletNetwork } from "~/lib/wallet";

export const meta: MetaFunction = () => {
  return [
    { title: "Accounts - Pulsar" },
    { name: "description", content: "Manage your wallet accounts" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  const wallets = await prisma.wallet.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return json({ user, wallets });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "add") {
    const address = formData.get("address");
    const name = formData.get("name");

    if (typeof address !== "string" || !address.trim()) {
      return json({ error: "Wallet address is required" }, { status: 400 });
    }

    const detection = detectWalletNetwork(address.trim());

    if (!detection.valid || !detection.network) {
      return json({ error: detection.error || "Invalid wallet address" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.wallet.findFirst({
      where: {
        userId: user.id,
        address: address.trim(),
      },
    });

    if (existing) {
      return json({ error: "This wallet address is already added" }, { status: 400 });
    }

    await prisma.wallet.create({
      data: {
        userId: user.id,
        network: detection.network,
        address: address.trim(),
        name: typeof name === "string" && name.trim() ? name.trim() : null,
      },
    });

    return json({ success: true });
  }

  if (intent === "delete") {
    const walletId = formData.get("walletId");

    if (typeof walletId !== "string") {
      return json({ error: "Invalid wallet" }, { status: 400 });
    }

    // Ensure the wallet belongs to the user
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: walletId,
        userId: user.id,
      },
    });

    if (!wallet) {
      return json({ error: "Wallet not found" }, { status: 404 });
    }

    await prisma.wallet.delete({
      where: { id: walletId },
    });

    return json({ success: true });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

function NetworkIcon({ network }: { network: string }) {
  switch (network) {
    case "bitcoin":
      return <Bitcoin className="h-5 w-5 text-orange-500" />;
    case "ethereum":
      return (
        <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1.5L5.5 12.25L12 16L18.5 12.25L12 1.5ZM12 17.25L5.5 13.5L12 22.5L18.5 13.5L12 17.25Z" />
        </svg>
      );
    case "solana":
      return (
        <svg className="h-5 w-5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 6h16l-2.5 3H6.5L4 6Zm0 12h16l-2.5-3H6.5L4 18Zm2.5-6h11l2.5 3H4l2.5-3Z" />
        </svg>
      );
    default:
      return <Wallet className="h-5 w-5 text-muted-foreground" />;
  }
}

function getNetworkBadgeVariant(network: string): "default" | "secondary" | "outline" {
  switch (network) {
    case "bitcoin":
      return "outline";
    case "ethereum":
      return "secondary";
    case "solana":
      return "default";
    default:
      return "outline";
  }
}

export default function AccountsPage() {
  const { user, wallets } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />

      <main className="flex-1 p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">Accounts</h1>
            <p className="text-muted-foreground">
              Manage your wallet addresses for portfolio tracking
            </p>
          </div>

          <Form method="post" action="/auth/logout">
            <Button variant="ghost" size="icon" type="submit" title="Sign out">
              <LogOut className="h-5 w-5" />
            </Button>
          </Form>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Add Wallet Card */}
          <Card className="lg:col-span-1 border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Add Wallet</CardTitle>
              <CardDescription>
                Enter a wallet address to track. We'll automatically detect the network.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="add" />

                {actionData && "error" in actionData && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                    {actionData.error}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">
                    Name (optional)
                  </label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="e.g., Main Wallet"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="address" className="text-sm font-medium text-foreground">
                    Wallet Address
                  </label>
                  <Input
                    id="address"
                    name="address"
                    type="text"
                    required
                    placeholder="Enter Bitcoin, Ethereum, or Solana address"
                    className="h-11 font-mono text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Adding..." : "Add Wallet"}
                </Button>
              </Form>
            </CardContent>
          </Card>

          {/* Wallets List */}
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Your Wallets</CardTitle>
              <CardDescription>
                {wallets.length === 0
                  ? "No wallets added yet"
                  : `${wallets.length} wallet${wallets.length === 1 ? "" : "s"} tracked`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {wallets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Add your first wallet to start tracking your portfolio.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
                          <NetworkIcon network={wallet.network} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {wallet.name ? (
                              <span className="font-medium text-foreground">
                                {wallet.name}
                              </span>
                            ) : (
                              <span className="font-mono text-sm text-foreground">
                                {formatAddress(wallet.address)}
                              </span>
                            )}
                            <Badge variant={getNetworkBadgeVariant(wallet.network)}>
                              {getNetworkDisplayName(wallet.network as WalletNetwork)}
                            </Badge>
                          </div>
                          {wallet.name && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatAddress(wallet.address, 8, 6)}
                            </span>
                          )}
                        </div>
                      </div>

                      <Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="walletId" value={wallet.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove wallet"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Form>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
