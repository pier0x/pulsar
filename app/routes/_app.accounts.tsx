import { useState, useEffect, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useRevalidator } from "@remix-run/react";
import { Plus, Trash2, Wallet, Bitcoin, Building2, LineChart, Landmark } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaidLink } from "react-plaid-link";
import { Button, Input, FormField, Alert, Card } from "~/components/ui";
import { requireAuth } from "~/lib/auth";
import { detectAddressType, validateWalletForNetwork } from "~/lib/wallet.server";
import { 
  formatAddress, 
  getNetworkDisplayName, 
  type WalletNetwork,
  EVM_NETWORKS,
  NETWORK_INFO,
} from "~/lib/wallet";
import { hasHyperliquidAccount } from "~/lib/providers/hyperliquid.server";
import { prisma } from "~/lib/db.server";
import {
  getUserAccountsWithLatestSnapshot,
  createOnchainAccountsForAddress,
  createOnchainAccount,
  deleteAccount,
  deleteOnchainAccountsByAddress,
} from "~/lib/accounts.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Accounts - Pulsar" },
    { name: "description", content: "Manage your wallet accounts" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const accounts = await getUserAccountsWithLatestSnapshot(user.id);
  return json({ accounts });
}

// Badge component for network display
function NetworkBadge({ network }: { network: string }) {
  const info = NETWORK_INFO[network as WalletNetwork];
  const color = info?.color || "#71717a";
  
  return (
    <span 
      className="text-xs px-2 py-0.5 rounded-full border"
      style={{ 
        backgroundColor: `${color}15`,
        color: color,
        borderColor: `${color}30`,
      }}
    >
      {getNetworkDisplayName(network as WalletNetwork)}
    </span>
  );
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

    const detection = detectAddressType(address.trim());
    if (!detection.valid) {
      return json({ error: detection.error || "Invalid wallet address" }, { status: 400 });
    }

    const walletName = typeof name === "string" && name.trim() ? name.trim() : "Wallet";

    if (detection.addressType === "evm") {
      const existing = await getUserAccountsWithLatestSnapshot(user.id);
      const alreadyExists = existing.some(
        (a) => a.address?.toLowerCase() === address.trim().toLowerCase() && a.type === "onchain"
      );

      if (alreadyExists) {
        return json({ error: "This EVM address is already added" }, { status: 400 });
      }

      const networks: Array<{ network: string; provider: "alchemy" | "helius" | "hyperliquid" | "plaid" }> = 
        EVM_NETWORKS.map((net) => ({ network: net, provider: "alchemy" as const }));

      const hasHL = await hasHyperliquidAccount(address.trim());
      if (hasHL) {
        networks.push({ network: "hyperliquid", provider: "hyperliquid" });
      }

      await createOnchainAccountsForAddress(user.id, address.trim(), walletName, networks);
      return json({ success: true, hyperliquid: hasHL });
    }

    const finalNetwork = detection.suggestedNetwork!;
    const validation = validateWalletForNetwork(address.trim(), finalNetwork);
    if (!validation.valid) {
      return json({ error: validation.error || "Invalid address for this network" }, { status: 400 });
    }

    const existing = await getUserAccountsWithLatestSnapshot(user.id);
    const alreadyExists = existing.some(
      (a) => a.address?.toLowerCase() === address.trim().toLowerCase() && a.network === finalNetwork
    );

    if (alreadyExists) {
      return json({ error: "This wallet address is already added" }, { status: 400 });
    }

    const provider = finalNetwork === "solana" ? "helius" : "alchemy";
    await createOnchainAccount({
      userId: user.id,
      name: walletName,
      provider: provider as "alchemy" | "helius",
      network: finalNetwork,
      address: address.trim(),
    });

    return json({ success: true });
  }

  if (intent === "delete") {
    const accountId = formData.get("accountId");
    const address = formData.get("address");
    const isEvm = formData.get("isEvm") === "true";
    const isBank = formData.get("isBank") === "true";

    if (typeof accountId !== "string" && typeof address !== "string") {
      return json({ error: "Invalid account" }, { status: 400 });
    }

    if (isEvm && typeof address === "string") {
      await deleteOnchainAccountsByAddress(user.id, address);
    } else if (typeof accountId === "string") {
      // For bank accounts with a plaidConnectionId, we could optionally delete the connection too
      // For now, just delete the account (other accounts on the same connection stay)
      if (isBank) {
        const account = await prisma.account.findFirst({
          where: { id: accountId, userId: user.id },
          select: { plaidConnectionId: true },
        });
        await deleteAccount(user.id, accountId);
        // Clean up orphaned PlaidConnection (no remaining accounts)
        if (account?.plaidConnectionId) {
          const remaining = await prisma.account.count({
            where: { plaidConnectionId: account.plaidConnectionId },
          });
          if (remaining === 0) {
            await prisma.plaidConnection.delete({
              where: { id: account.plaidConnectionId },
            });
          }
        }
      } else {
        await deleteAccount(user.id, accountId);
      }
    }

    return json({ success: true });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

function NetworkIcon({ network }: { network: string }) {
  const info = NETWORK_INFO[network as WalletNetwork];
  const color = info?.color || "#71717a";

  switch (network) {
    case "bitcoin":
      return <Bitcoin className="h-5 w-5" style={{ color }} />;
    case "ethereum":
    case "arbitrum":
    case "base":
    case "polygon":
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill={color}>
          <path d="M12 1.5L5.5 12.25L12 16L18.5 12.25L12 1.5ZM12 17.25L5.5 13.5L12 22.5L18.5 13.5L12 17.25Z" />
        </svg>
      );
    case "solana":
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill={color}>
          <path d="M4 6h16l-2.5 3H6.5L4 6Zm0 12h16l-2.5-3H6.5L4 18Zm2.5-6h11l2.5 3H4l2.5-3Z" />
        </svg>
      );
    default:
      return <Wallet className="h-5 w-5" style={{ color }} />;
  }
}

// ---------------------------------------------------------------------------
// Connect Bank button using react-plaid-link
// ---------------------------------------------------------------------------

interface ConnectBankButtonProps {
  onSuccess: () => void;
}

function ConnectBankButton({ onSuccess }: ConnectBankButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch a link token from our API
  const fetchLinkToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to initialize bank connection");
        return;
      }
      setLinkToken(data.linkToken);
    } catch (err) {
      setError("Failed to connect to Plaid");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePlaidSuccess = useCallback(
    async (publicToken: string, metadata: unknown) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken, metadata }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error || "Failed to connect bank account");
          return;
        }
        onSuccess();
      } catch (err) {
        setError("Failed to save bank connection");
      } finally {
        setIsLoading(false);
        setLinkToken(null);
      }
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: handlePlaidSuccess,
    onExit: () => {
      setLinkToken(null);
    },
  });

  // Auto-open when token is ready
  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="w-full cursor-pointer border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
        disabled={isLoading}
        onClick={fetchLinkToken}
      >
        <Landmark className="h-4 w-4 mr-2" />
        {isLoading ? "Connecting..." : "Connect Bank Account"}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Account Form
// ---------------------------------------------------------------------------

type AccountTabType = "wallet" | "bank";

const accountTabs: { id: AccountTabType; label: string; icon: typeof Wallet }[] = [
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "bank", label: "Bank", icon: Landmark },
];

function AddAccountForm({ onBankConnected }: { onBankConnected: () => void }) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  
  const [accountTab, setAccountTab] = useState<AccountTabType>("wallet");
  const [address, setAddress] = useState("");
  const [addressType, setAddressType] = useState<"bitcoin" | "evm" | "solana" | null>(null);

  useEffect(() => {
    if (!address.trim()) {
      setAddressType(null);
      return;
    }
    if (address.startsWith("0x") && address.length === 42) {
      setAddressType("evm");
    } else if (
      address.startsWith("1") || 
      address.startsWith("3") || 
      address.toLowerCase().startsWith("bc1")
    ) {
      setAddressType("bitcoin");
    } else if (address.length >= 32 && address.length <= 44 && !address.startsWith("0x")) {
      setAddressType("solana");
    } else {
      setAddressType(null);
    }
  }, [address]);

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      setAddress("");
      setAddressType(null);
    }
  }, [actionData]);

  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Add Account</h2>
        <p className="text-zinc-500 text-sm">
          Connect an account to track your portfolio.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-lg mb-6">
        {accountTabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = accountTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAccountTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer
                ${isSelected 
                  ? "bg-zinc-700 text-white" 
                  : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800"
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Wallet Form */}
      {accountTab === "wallet" && (
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
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x... / bc1... / So1..."
              className="font-mono text-sm"
            />
          </FormField>

          {addressType === "evm" && (
            <div className="flex items-center gap-2 text-sm text-zinc-400 flex-wrap">
              <span>Networks:</span>
              {EVM_NETWORKS.map((net) => (
                <NetworkBadge key={net} network={net} />
              ))}
            </div>
          )}

          {addressType && addressType !== "evm" && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Detected:</span>
              <NetworkBadge network={addressType === "bitcoin" ? "bitcoin" : "solana"} />
            </div>
          )}

          <Button type="submit" className="w-full cursor-pointer" disabled={isSubmitting || !address.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            {isSubmitting ? "Adding..." : "Add Wallet"}
          </Button>
        </Form>
      )}

      {/* Bank tab — Plaid Link */}
      {accountTab === "bank" && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Securely connect your bank account via Plaid. Pulsar only reads balance data — no transaction access.
          </p>
          <ConnectBankButton onSuccess={onBankConnected} />
          <p className="text-xs text-zinc-600 text-center">
            Powered by Plaid · Bank-level encryption
          </p>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AccountsPage() {
  const { accounts } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();

  const handleBankConnected = useCallback(() => {
    revalidate();
  }, [revalidate]);

  // Group EVM accounts by address for display
  const evmByAddress = new Map<string, typeof accounts>();
  const nonEvmAccounts: typeof accounts = [];

  for (const a of accounts) {
    if (a.type !== "onchain" || !a.address) {
      nonEvmAccounts.push(a);
      continue;
    }
    if (EVM_NETWORKS.includes(a.network as WalletNetwork)) {
      const key = a.address.toLowerCase();
      const group = evmByAddress.get(key) || [];
      group.push(a);
      evmByAddress.set(key, group);
    } else {
      nonEvmAccounts.push(a);
    }
  }

  // Build display items
  type DisplayItem = {
    id: string;
    address: string;
    name: string;
    network: string;
    isEvm: boolean;
    isBank: boolean;
    isBrokerage?: boolean;
    balance: string | null;
    networks?: string[];
    subtitle?: string;
  };

  const displayItems: DisplayItem[] = [];

  // EVM wallets
  for (const [, group] of evmByAddress) {
    const primary = group.find((w) => w.network === "ethereum") || group[0];
    const totalUsd = group.reduce((sum, a) => {
      const snap = a.snapshots[0];
      return sum + (snap ? Number(snap.totalUsdValue) : 0);
    }, 0);
    const hasAnyBalance = group.some((a) => a.snapshots[0]);

    displayItems.push({
      id: primary.id,
      address: primary.address || "",
      name: primary.name,
      network: primary.network || "ethereum",
      isEvm: true,
      isBank: false,
      balance: hasAnyBalance
        ? `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null,
      networks: group.map((a) => a.network || "").filter(Boolean),
    });
  }

  // Non-EVM onchain accounts
  for (const a of nonEvmAccounts) {
    if (a.type !== "onchain") continue;
    const snap = a.snapshots[0];
    displayItems.push({
      id: a.id,
      address: a.address || "",
      name: a.name,
      network: a.network || "unknown",
      isEvm: false,
      isBank: false,
      balance: snap
        ? `$${Number(snap.totalUsdValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null,
    });
  }

  // Bank accounts
  const bankAccounts = accounts.filter((a) => a.type === "bank" && a.provider === "plaid");
  for (const a of bankAccounts) {
    const snap = a.snapshots[0];
    const balance = snap ? Number(snap.totalUsdValue) : null;
    displayItems.push({
      id: a.id,
      address: "",
      name: a.name,
      network: "bank",
      isEvm: false,
      isBank: true,
      balance: balance !== null
        ? `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null,
      subtitle: a.plaidSubtype
        ? a.plaidSubtype.charAt(0).toUpperCase() + a.plaidSubtype.slice(1)
        : "Bank Account",
    });
  }

  // Brokerage accounts
  const brokerageAccounts = accounts.filter((a) => a.type === "brokerage" && a.provider === "plaid");
  for (const a of brokerageAccounts) {
    const snap = a.snapshots[0];
    const balance = snap ? Number(snap.totalUsdValue) : null;
    displayItems.push({
      id: a.id,
      address: "",
      name: a.name,
      network: "brokerage",
      isEvm: false,
      isBank: false,
      isBrokerage: true,
      balance: balance !== null
        ? `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null,
      subtitle: a.plaidSubtype
        ? a.plaidSubtype.charAt(0).toUpperCase() + a.plaidSubtype.slice(1)
        : "Brokerage",
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Add Account Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <AddAccountForm onBankConnected={handleBankConnected} />
      </motion.div>

      {/* Accounts List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">Your Accounts</h2>
            <p className="text-zinc-500 text-sm">
              {displayItems.length === 0
                ? "No accounts added yet"
                : `${displayItems.length} account${displayItems.length === 1 ? "" : "s"} tracked`}
            </p>
          </div>

          {displayItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Wallet className="h-8 w-8 text-zinc-600" />
              </div>
              <p className="text-zinc-500">Add your first account to start tracking your portfolio.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {displayItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                        {item.isBank ? (
                          <Landmark className="h-5 w-5 text-emerald-400" />
                        ) : item.isBrokerage ? (
                          <LineChart className="h-5 w-5 text-violet-400" />
                        ) : (
                          <NetworkIcon network={item.network} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white text-sm sm:text-base truncate">
                            {item.name}
                          </span>
                          {item.isBank ? (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-emerald-700/50 text-emerald-400 bg-emerald-500/10">
                              {item.subtitle || "Bank"}
                            </span>
                          ) : item.isBrokerage ? (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-violet-700/50 text-violet-400 bg-violet-500/10">
                              {item.subtitle || "Brokerage"}
                            </span>
                          ) : item.isEvm ? (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400">
                              Multi-chain
                            </span>
                          ) : (
                            <NetworkBadge network={item.network} />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!item.isBank && !item.isBrokerage && (
                            <span className="font-mono text-[10px] sm:text-xs text-zinc-500 truncate">
                              {formatAddress(item.address, 6, 4)}
                            </span>
                          )}
                          {item.balance && (
                            <span className={`text-[10px] sm:text-xs font-medium ${item.isBrokerage ? "text-violet-400" : "text-emerald-400"}`}>
                              {item.balance}
                            </span>
                          )}
                          {!item.balance && (
                            <span className="text-[10px] sm:text-xs text-zinc-600">
                              No balance yet
                            </span>
                          )}
                        </div>
                        {item.isEvm && item.networks && item.networks.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {item.networks.map((net) => (
                              <NetworkBadge key={net} network={net} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="accountId" value={item.id} />
                      <input type="hidden" name="address" value={item.address} />
                      <input type="hidden" name="isEvm" value={item.isEvm ? "true" : "false"} />
                      <input type="hidden" name="isBank" value={(item.isBank || item.isBrokerage) ? "true" : "false"} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        title="Remove account"
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
