import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Plus, Trash2, Wallet, Bitcoin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input, FormField, Alert, Card, Badge } from "~/components/ui";
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
        <svg className="h-5 w-5 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1.5L5.5 12.25L12 16L18.5 12.25L12 1.5ZM12 17.25L5.5 13.5L12 22.5L18.5 13.5L12 17.25Z" />
        </svg>
      );
    case "solana":
      return (
        <svg className="h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 6h16l-2.5 3H6.5L4 6Zm0 12h16l-2.5-3H6.5L4 18Zm2.5-6h11l2.5 3H4l2.5-3Z" />
        </svg>
      );
    default:
      return <Wallet className="h-5 w-5 text-zinc-500" />;
  }
}

function getNetworkColor(network: string): string {
  switch (network) {
    case "bitcoin":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "ethereum":
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    case "solana":
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

export default function AccountsPage() {
  const { wallets } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Add Wallet Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="lg:col-span-1"
      >
        <Card>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">Add Wallet</h2>
            <p className="text-zinc-500 text-sm">
              Enter a wallet address to track. We'll automatically detect the network.
            </p>
          </div>

          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="add" />

            {actionData && "error" in actionData && (
              <Alert variant="error">{actionData.error}</Alert>
            )}

            <FormField label="Name (optional)" htmlFor="name">
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="e.g., Main Wallet"
              />
            </FormField>

            <FormField label="Wallet Address" htmlFor="address">
              <Input
                id="address"
                name="address"
                type="text"
                required
                placeholder="Enter Bitcoin, Ethereum, or Solana address"
                className="font-mono text-sm"
              />
            </FormField>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <Plus className="h-4 w-4 mr-2" />
              {isSubmitting ? "Adding..." : "Add Wallet"}
            </Button>
          </Form>
        </Card>
      </motion.div>

      {/* Wallets List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="lg:col-span-2"
      >
        <Card>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">Your Wallets</h2>
            <p className="text-zinc-500 text-sm">
              {wallets.length === 0
                ? "No wallets added yet"
                : `${wallets.length} wallet${wallets.length === 1 ? "" : "s"} tracked`}
            </p>
          </div>

          {wallets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Wallet className="h-8 w-8 text-zinc-600" />
              </div>
              <p className="text-zinc-500">Add your first wallet to start tracking your portfolio.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {wallets.map((wallet, index) => (
                  <motion.div
                    key={wallet.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center">
                        <NetworkIcon network={wallet.network} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {wallet.name ? (
                            <span className="font-medium text-white">
                              {wallet.name}
                            </span>
                          ) : (
                            <span className="font-mono text-sm text-white">
                              {formatAddress(wallet.address)}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${getNetworkColor(wallet.network)}`}>
                            {getNetworkDisplayName(wallet.network as WalletNetwork)}
                          </span>
                        </div>
                        {wallet.name && (
                          <span className="font-mono text-xs text-zinc-500">
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
                        size="icon-sm"
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        title="Remove wallet"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Form>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
