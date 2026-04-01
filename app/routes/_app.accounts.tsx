import { useState, useEffect, useCallback, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useRevalidator } from "@remix-run/react";
import { Plus, Trash2, Wallet, Bitcoin, LineChart, Landmark, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button, Input, FormField, Alert, Card, Badge } from "~/components/ui";
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
    { title: "Pulsar" },
  ];
};

// Recursively convert Prisma Decimal instances to plain numbers to avoid SSR/client hydration mismatch
function serializeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (typeof obj === "object" && "toFixed" in (obj as any) && "toNumber" in (obj as any)) {
    return Number((obj as any).toNumber()) as unknown as T;
  }
  if (Array.isArray(obj)) return obj.map(serializeDecimals) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeDecimals(value);
    }
    return result as T;
  }
  return obj;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const accounts = await getUserAccountsWithLatestSnapshot(user.id);

  return json({ accounts: serializeDecimals(accounts) });
}

// Badge component for network display
function NetworkBadge({ network }: { network: string }) {
  const info = NETWORK_INFO[network as WalletNetwork];
  const color = info?.color || "#71717a";
  
  return (
    <span 
      className="text-label px-2 py-0.5 rounded-md border"
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

      const networks: Array<{ network: string; provider: "alchemy" | "helius" | "hyperliquid" }> = 
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
      if (isBank) {
        const account = await prisma.account.findFirst({
          where: { id: accountId, userId: user.id },
          select: { simplefinConnectionId: true },
        });
        await deleteAccount(user.id, accountId);
        // Clean up orphaned SimplefinConnection (no remaining accounts)
        if (account?.simplefinConnectionId) {
          const remaining = await prisma.account.count({
            where: { simplefinConnectionId: account.simplefinConnectionId },
          });
          if (remaining === 0) {
            await prisma.simplefinConnection.delete({
              where: { id: account.simplefinConnectionId },
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
// Connect Bank section using SimpleFIN Bridge
// ---------------------------------------------------------------------------

interface ConnectBankSectionProps {
  onSuccess: () => void;
}

function ConnectBankSection({ onSuccess }: ConnectBankSectionProps) {
  const [setupToken, setSetupToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!setupToken.trim()) return;

      setIsLoading(true);
      setError(null);
      setSuccessMsg(null);

      try {
        const res = await fetch("/api/simplefin/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setupToken: setupToken.trim() }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error || "Failed to connect bank account");
          return;
        }
        setSuccessMsg(
          `Connected ${data.connectionLabel} — ${data.accountsCreated} account${data.accountsCreated === 1 ? "" : "s"} added`
        );
        setSetupToken("");
        onSuccess();
      } catch (err) {
        setError("Failed to connect bank account");
      } finally {
        setIsLoading(false);
      }
    },
    [setupToken, onSuccess]
  );

  return (
    <div className="space-y-4">
      {/* Step 1 */}
      <div className="flex items-start gap-3 p-3 rounded-[12px] bg-nd-surface-raised border border-nd-border-visible">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-nd-surface border border-nd-border-visible text-nd-text-secondary text-xs font-mono shrink-0 mt-0.5">1</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-nd-text-secondary mb-1">Connect your bank via SimpleFIN Bridge</p>
          <a
            href="https://bridge.simplefin.org/simplefin/create"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-nd-text-secondary hover:text-nd-text-primary transition-nd"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open SimpleFIN Bridge
          </a>
        </div>
      </div>

      {/* Step 2 */}
      <div className="flex items-start gap-3 p-3 rounded-[12px] bg-nd-surface-raised border border-nd-border-visible">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-nd-surface border border-nd-border-visible text-nd-text-secondary text-xs font-mono shrink-0 mt-0.5">2</span>
        <p className="text-sm text-nd-text-secondary">Connect your bank there, then copy the <strong className="text-nd-text-primary">Setup Token</strong> you receive.</p>
      </div>

      {/* Step 3 */}
      <div className="flex items-start gap-3 p-3 rounded-[12px] bg-nd-surface-raised border border-nd-border-visible">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-nd-surface border border-nd-border-visible text-nd-text-secondary text-xs font-mono shrink-0 mt-0.5">3</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-nd-text-secondary mb-2">Paste your Setup Token below</p>
          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              placeholder="Paste Setup Token here..."
              rows={3}
              className="w-full px-3 py-2 rounded-[12px] bg-nd-surface border border-nd-border text-nd-text-primary placeholder:text-nd-text-disabled focus:outline-none focus:border-nd-border-visible resize-none text-sm font-mono"
            />
            <Button
              type="submit"
              disabled={isLoading || !setupToken.trim()}
              className="w-full cursor-pointer"
            >
              {isLoading ? "Connecting..." : "Connect Bank"}
            </Button>
          </form>
        </div>
      </div>

      {error && <p className="text-label text-nd-accent">{error}</p>}
      {successMsg && <p className="text-label text-nd-success">{successMsg}</p>}

      <p className="text-label text-nd-text-disabled text-center">
        SimpleFIN Bridge · No credentials stored by Pulsar
      </p>
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
    <>
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-nd-surface-raised rounded-md mb-6">
        {accountTabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = accountTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAccountTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-nd cursor-pointer
                ${isSelected 
                  ? "bg-nd-surface text-nd-text-display" 
                  : "text-nd-text-secondary hover:text-nd-text-primary hover:bg-nd-surface"
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
            <div className="flex items-center gap-2 text-sm text-nd-text-secondary flex-wrap">
              <span>Networks:</span>
              {EVM_NETWORKS.map((net) => (
                <NetworkBadge key={net} network={net} />
              ))}
            </div>
          )}

          {addressType && addressType !== "evm" && (
            <div className="flex items-center gap-2 text-sm text-nd-text-secondary">
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

      {/* Bank tab — SimpleFIN */}
      {accountTab === "bank" && (
        <ConnectBankSection onSuccess={onBankConnected} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page (assets removed — see /assets)
// ---------------------------------------------------------------------------

export default function AccountsPage() {
  const { accounts } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [showAddForm, setShowAddForm] = useState(false);
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const handleBankConnected = useCallback(() => {
    revalidate();
  }, [revalidate]);

  // Auto-close form on successful add
  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      if (navigation.state === "idle") {
        setShowAddForm(false);
      }
    }
  }, [actionData, navigation.state]);

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
        ? `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
        ? `$${Number(snap.totalUsdValue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null,
    });
  }

  // Bank accounts (SimpleFIN)
  const bankAccounts = accounts.filter((a) => a.type === "bank" && a.provider === "simplefin");
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
        ? `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null,
      subtitle: "Bank Account",
    });
  }

  // Brokerage accounts (SimpleFIN)
  const brokerageAccounts = accounts.filter((a) => a.type === "brokerage" && (a.provider === "simplefin" || a.provider === "ibkr-flex"));
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
        ? `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null,
      subtitle: "Brokerage",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-nd-text-display">Accounts</h1>
          <p className="text-nd-text-disabled text-sm mt-1">
            {displayItems.length === 0
              ? "Connect wallets, banks, and brokerages"
              : `${displayItems.length} account${displayItems.length === 1 ? "" : "s"} tracked`}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </div>

      {/* Add form (collapsible) */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <Card>
              <h3 className="text-label text-nd-text-secondary mb-4">NEW ACCOUNT</h3>
              <AddAccountForm onBankConnected={handleBankConnected} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accounts List */}
      {displayItems.length === 0 && !showAddForm ? (
        <Card>
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-nd-surface border border-nd-border flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-nd-text-disabled" />
            </div>
            <p className="text-nd-text-secondary font-medium mb-1">No accounts yet</p>
            <p className="text-nd-text-disabled text-sm">Add your first one to start tracking your portfolio.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {displayItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-[12px] bg-nd-surface-raised hover:bg-nd-surface border border-nd-border transition-nd gap-3"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-nd-surface border border-nd-border flex items-center justify-center shrink-0">
                        {item.isBank ? (
                          <Landmark className="h-5 w-5 text-nd-success" />
                        ) : item.isBrokerage ? (
                          <LineChart className="h-5 w-5 text-nd-text-secondary" />
                        ) : (
                          <NetworkIcon network={item.network} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-nd-text-primary text-sm sm:text-base truncate">
                            {item.name}
                          </span>
                          {item.isBank ? (
                            <Badge variant="success">{item.subtitle || "Bank"}</Badge>
                          ) : item.isBrokerage ? (
                            <Badge variant="default">{item.subtitle || "Brokerage"}</Badge>
                          ) : item.isEvm ? (
                            <span title={item.networks?.map(n => {
                              const info = NETWORK_INFO[n as WalletNetwork];
                              return info?.displayName || n;
                            }).join(", ")}>
                              <Badge variant="default">ETH</Badge>
                            </span>
                          ) : (
                            <NetworkBadge network={item.network} />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!item.isBank && !item.isBrokerage && (
                            <span className="font-mono text-[10px] sm:text-xs text-nd-text-disabled truncate">
                              {formatAddress(item.address, 6, 4)}
                            </span>
                          )}
                          {item.balance && (
                            <span className="text-[10px] sm:text-xs font-mono text-nd-success">
                              {item.balance}
                            </span>
                          )}
                          {!item.balance && (
                            <span className="text-[10px] sm:text-xs text-nd-text-disabled">
                              No balance yet
                            </span>
                          )}
                        </div>

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
                        className="text-nd-text-disabled hover:text-nd-accent hover:bg-nd-accent-subtle"
                        title="Remove account"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Form>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Card>
        )}
    </div>
  );
}
