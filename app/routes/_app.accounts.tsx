import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Plus, Trash2, Wallet, Bitcoin, RefreshCw, Building2, LineChart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input, FormField, Alert, Card, Select, SelectOption } from "~/components/ui";
import { requireAuth } from "~/lib/auth";
import { prisma } from "~/lib/db.server";
import { detectAddressType, validateWalletForNetwork } from "~/lib/wallet.server";
import { 
  formatAddress, 
  getNetworkDisplayName, 
  type WalletNetwork,
  EVM_NETWORKS,
  NETWORK_INFO,
} from "~/lib/wallet";

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
    include: {
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: {
          totalUsdValue: true,
          timestamp: true,
        },
      },
    },
  });

  return json({ wallets });
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
    const network = formData.get("network");

    if (typeof address !== "string" || !address.trim()) {
      return json({ error: "Wallet address is required" }, { status: 400 });
    }

    // Detect address type
    const detection = detectAddressType(address.trim());
    if (!detection.valid) {
      return json({ error: detection.error || "Invalid wallet address" }, { status: 400 });
    }

    // For EVM addresses, network must be selected
    let finalNetwork: WalletNetwork;
    if (detection.addressType === "evm") {
      if (typeof network !== "string" || !EVM_NETWORKS.includes(network as WalletNetwork)) {
        return json({ error: "Please select a network for this EVM address" }, { status: 400 });
      }
      finalNetwork = network as WalletNetwork;
    } else {
      finalNetwork = detection.suggestedNetwork!;
    }

    // Validate address for the selected network
    const validation = validateWalletForNetwork(address.trim(), finalNetwork);
    if (!validation.valid) {
      return json({ error: validation.error || "Invalid address for this network" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.wallet.findFirst({
      where: {
        userId: user.id,
        address: address.trim(),
        network: finalNetwork,
      },
    });

    if (existing) {
      return json({ error: "This wallet address is already added for this network" }, { status: 400 });
    }

    await prisma.wallet.create({
      data: {
        userId: user.id,
        network: finalNetwork,
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

type AccountType = "wallet" | "cex" | "broker";

const accountTypes: { id: AccountType; label: string; icon: typeof Wallet; enabled: boolean }[] = [
  { id: "wallet", label: "Wallet", icon: Wallet, enabled: true },
  { id: "cex", label: "CEX", icon: Building2, enabled: false },
  { id: "broker", label: "Broker", icon: LineChart, enabled: false },
];

function AddAccountForm() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  
  const [accountType, setAccountType] = useState<AccountType>("wallet");
  const [address, setAddress] = useState("");
  const [addressType, setAddressType] = useState<"bitcoin" | "evm" | "solana" | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<WalletNetwork>("ethereum");

  // Detect address type when address changes
  useEffect(() => {
    if (!address.trim()) {
      setAddressType(null);
      return;
    }

    // Simple client-side detection
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

  // Reset form on success
  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      setAddress("");
      setAddressType(null);
      setSelectedNetwork("ethereum");
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

      {/* Account Type Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-lg mb-6">
        {accountTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = accountType === type.id;
          const isDisabled = !type.enabled;
          
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => type.enabled && setAccountType(type.id)}
              disabled={isDisabled}
              className={`
                flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer
                ${isSelected 
                  ? "bg-zinc-700 text-white" 
                  : isDisabled
                    ? "text-zinc-600 cursor-not-allowed"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800"
                }
              `}
              title={isDisabled ? "Coming soon" : undefined}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{type.label}</span>
              {isDisabled && <span className="text-[10px] text-zinc-500 hidden sm:inline">(Soon)</span>}
            </button>
          );
        })}
      </div>

      {/* Wallet Form */}
      {accountType === "wallet" && (
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

          {/* Network selector for EVM addresses */}
          {addressType === "evm" && (
            <FormField 
              label="Network" 
              htmlFor="network"
              hint="Select which network this address is on"
            >
              <Select
                id="network"
                name="network"
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value as WalletNetwork)}
              >
                {EVM_NETWORKS.map((net) => (
                  <SelectOption key={net} value={net}>
                    {getNetworkDisplayName(net)}
                  </SelectOption>
                ))}
              </Select>
            </FormField>
          )}

          {/* Auto-detected network indicator */}
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

      {/* CEX Placeholder */}
      {accountType === "cex" && (
        <div className="text-center py-8">
          <Building2 className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">CEX integration coming soon</p>
        </div>
      )}

      {/* Broker Placeholder */}
      {accountType === "broker" && (
        <div className="text-center py-8">
          <LineChart className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">Broker integration coming soon</p>
        </div>
      )}
    </Card>
  );
}

export default function AccountsPage() {
  const { wallets } = useLoaderData<typeof loader>();

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
      {/* Add Account Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="lg:col-span-1"
      >
        <AddAccountForm />
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
            <h2 className="text-lg font-semibold text-white mb-1">Your Accounts</h2>
            <p className="text-zinc-500 text-sm">
              {wallets.length === 0
                ? "No accounts added yet"
                : `${wallets.length} account${wallets.length === 1 ? "" : "s"} tracked`}
            </p>
          </div>

          {wallets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Wallet className="h-8 w-8 text-zinc-600" />
              </div>
              <p className="text-zinc-500">Add your first account to start tracking your portfolio.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {wallets.map((wallet, index) => {
                  const latestSnapshot = wallet.snapshots[0];
                  const balance = latestSnapshot 
                    ? `$${Number(latestSnapshot.totalUsdValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : null;

                  return (
                    <motion.div
                      key={wallet.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                          <NetworkIcon network={wallet.network} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {wallet.name ? (
                              <span className="font-medium text-white text-sm sm:text-base truncate">
                                {wallet.name}
                              </span>
                            ) : (
                              <span className="font-mono text-xs sm:text-sm text-white truncate">
                                {formatAddress(wallet.address)}
                              </span>
                            )}
                            <NetworkBadge network={wallet.network} />
                          </div>
                          <div className="flex items-center gap-2">
                            {wallet.name && (
                              <span className="font-mono text-[10px] sm:text-xs text-zinc-500 truncate">
                                {formatAddress(wallet.address, 6, 4)}
                              </span>
                            )}
                            {balance && (
                              <span className="text-[10px] sm:text-xs text-emerald-400 font-medium">
                                {balance}
                              </span>
                            )}
                          </div>
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
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
