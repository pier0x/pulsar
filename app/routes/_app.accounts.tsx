import { useState, useEffect, useCallback, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { unstable_parseMultipartFormData, unstable_createMemoryUploadHandler, json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useRevalidator } from "@remix-run/react";
import { Plus, Trash2, Wallet, Bitcoin, LineChart, Landmark, Package, TrendingUp, TrendingDown, Clock, ImageIcon, X, Pencil, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
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
  createManualAsset,
  updateManualAssetValue,
  updateManualAssetDetails,
  deleteManualAsset,
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

  // Fetch manual assets separately to get the 2 latest snapshots (for gain/loss display)
  const manualAssets = await prisma.account.findMany({
    where: { userId: user.id, type: "manual" },
    orderBy: { createdAt: "desc" },
    include: {
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  return json({ accounts: serializeDecimals(accounts), manualAssets: serializeDecimals(manualAssets) });
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

  const contentType = request.headers.get("content-type") || "";
  let formData: FormData;
  let uploadedFile: { data: Uint8Array; filename: string } | null = null;

  if (contentType.includes("multipart/form-data")) {
    const handler = unstable_createMemoryUploadHandler({ maxPartSize: 5 * 1024 * 1024 });
    formData = await unstable_parseMultipartFormData(request, handler);

    const file = formData.get("image");
    if (file && typeof file === "object" && "stream" in file) {
      const blob = file as File;
      const buffer = await blob.arrayBuffer();
      uploadedFile = {
        data: new Uint8Array(buffer),
        filename: blob.name,
      };
    }
  } else {
    formData = await request.formData();
  }

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

  if (intent === "add-asset") {
    const name = formData.get("assetName");
    const category = formData.get("category");
    const currentValueRaw = formData.get("currentValue");
    const costBasisRaw = formData.get("costBasis");
    const notes = formData.get("notes");

    if (typeof name !== "string" || !name.trim()) {
      return json({ error: "Asset name is required" }, { status: 400 });
    }
    if (typeof category !== "string" || !category.trim()) {
      return json({ error: "Category is required" }, { status: 400 });
    }
    const currentValue = parseFloat(typeof currentValueRaw === "string" ? currentValueRaw : "0");
    if (isNaN(currentValue) || currentValue < 0) {
      return json({ error: "Current value must be a non-negative number" }, { status: 400 });
    }
    const costBasis = costBasisRaw && typeof costBasisRaw === "string" && costBasisRaw.trim()
      ? parseFloat(costBasisRaw)
      : undefined;

    // Create the asset first
    const account = await createManualAsset({
      userId: user.id,
      name: name.trim(),
      category: category.trim().toLowerCase(),
      currentValue,
      costBasis: costBasis && !isNaN(costBasis) ? costBasis : undefined,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : undefined,
    });

    // Save image if uploaded
    if (uploadedFile) {
      const ext = uploadedFile.filename.split(".").pop()?.toLowerCase() || "jpg";
      const imagePath = `data/assets/${account.id}.${ext}`;
      const fullPath = join(process.cwd(), imagePath);
      await mkdir(join(process.cwd(), "data", "assets"), { recursive: true });
      await writeFile(fullPath, uploadedFile.data);
      await prisma.account.update({
        where: { id: account.id },
        data: { imagePath },
      });
    }

    return json({ success: true });
  }

  if (intent === "update-asset") {
    const accountId = formData.get("accountId");
    if (typeof accountId !== "string") {
      return json({ error: "Invalid account" }, { status: 400 });
    }

    // Verify ownership
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id, type: "manual" },
    });
    if (!account) {
      return json({ error: "Asset not found" }, { status: 404 });
    }

    const name = formData.get("assetName");
    const category = formData.get("category");
    const currentValueRaw = formData.get("currentValue");
    const costBasisRaw = formData.get("costBasis");
    const notes = formData.get("notes");

    // Update details
    const updates: Parameters<typeof updateManualAssetDetails>[1] = {};
    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (typeof category === "string" && category.trim()) updates.category = category.trim().toLowerCase();
    if (typeof notes === "string") updates.notes = notes.trim() || null;

    const costBasis = costBasisRaw && typeof costBasisRaw === "string" && costBasisRaw.trim()
      ? parseFloat(costBasisRaw)
      : undefined;
    if (costBasis !== undefined && !isNaN(costBasis)) updates.costBasis = costBasis;

    // Handle image upload
    if (uploadedFile) {
      // Delete old image if exists
      if (account.imagePath) {
        const oldPath = join(process.cwd(), account.imagePath);
        try { await unlink(oldPath); } catch { /* ignore */ }
      }
      const ext = uploadedFile.filename.split(".").pop()?.toLowerCase() || "jpg";
      const imagePath = `data/assets/${account.id}.${ext}`;
      const fullPath = join(process.cwd(), imagePath);
      await mkdir(join(process.cwd(), "data", "assets"), { recursive: true });
      await writeFile(fullPath, uploadedFile.data);
      updates.imagePath = imagePath;
    }

    if (Object.keys(updates).length > 0) {
      await updateManualAssetDetails(accountId, updates);
    }

    // Update currentValue on Account if changed
    const currentValue = parseFloat(typeof currentValueRaw === "string" ? currentValueRaw : "");
    if (!isNaN(currentValue) && currentValue >= 0) {
      const oldValue = account.currentValue ? Number(account.currentValue) : -1;
      if (Math.abs(currentValue - oldValue) > 0.001) {
        await updateManualAssetValue(accountId, currentValue);
      }
    }

    return json({ success: true });
  }

  if (intent === "delete-asset") {
    const accountId = formData.get("accountId");
    if (typeof accountId !== "string") {
      return json({ error: "Invalid account" }, { status: 400 });
    }
    await deleteManualAsset(user.id, accountId);
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
      <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">1</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-300 mb-1">Connect your bank via SimpleFIN Bridge</p>
          <a
            href="https://bridge.simplefin.org/simplefin/create"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open SimpleFIN Bridge
          </a>
        </div>
      </div>

      {/* Step 2 */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">2</span>
        <p className="text-sm text-zinc-300">Connect your bank there, then copy the <strong className="text-white">Setup Token</strong> you receive.</p>
      </div>

      {/* Step 3 */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">3</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-300 mb-2">Paste your Setup Token below</p>
          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              placeholder="Paste Setup Token here..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 resize-none text-sm font-mono"
            />
            <button
              type="submit"
              disabled={isLoading || !setupToken.trim()}
              className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isLoading ? "Connecting..." : "Connect Bank"}
            </button>
          </form>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {successMsg && <p className="text-xs text-emerald-400">{successMsg}</p>}

      <p className="text-xs text-zinc-600 text-center">
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

      {/* Bank tab — SimpleFIN */}
      {accountTab === "bank" && (
        <ConnectBankSection onSuccess={onBankConnected} />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Physical Assets Section
// ---------------------------------------------------------------------------

type ManualAsset = {
  id: string;
  name: string;
  category: string | null;
  costBasis: string | null;
  currentValue: string | null;
  notes: string | null;
  imagePath: string | null;
  snapshots: Array<{ totalUsdValue: string; timestamp: string }>;
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full border border-amber-700/50 text-amber-400 bg-amber-500/10">
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </span>
  );
}

function EditAssetModal({ asset, currentValue, costBasis, onClose }: {
  asset: ManualAsset;
  currentValue: number;
  costBasis: number | null;
  onClose: () => void;
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [imagePreview, setImagePreview] = useState<string | null>(
    asset.imagePath ? `/api/asset-image/${asset.id}` : null
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Close modal after successful submission
  useEffect(() => {
    if (navigation.state === "idle" && isSubmitting) {
      onClose();
    }
  }, [navigation.state]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Edit Asset</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Form method="post" encType="multipart/form-data" className="space-y-4" onSubmit={onClose}>
          <input type="hidden" name="intent" value="update-asset" />
          <input type="hidden" name="accountId" value={asset.id} />

          {/* Image */}
          <div className="flex justify-center">
            <label className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden group-hover:border-zinc-500 transition-colors">
                {imagePreview ? (
                  <img src={imagePreview} alt="Asset" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-zinc-600" />
                )}
              </div>
              <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil className="h-4 w-4 text-white" />
              </div>
              <input
                type="file"
                name="image"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
          </div>

          {/* Name */}
          <div>
            <label className="block text-zinc-500 text-sm mb-1.5">Name</label>
            <input
              type="text"
              name="assetName"
              defaultValue={asset.name}
              required
              className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-zinc-500 text-sm mb-1.5">Category</label>
            <select
              name="category"
              defaultValue={asset.category || "watches"}
              required
              className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 cursor-pointer"
            >
              <option value="watches">Watches</option>
              <option value="cars">Cars</option>
            </select>
          </div>

          {/* Value + Cost Basis */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-500 text-sm mb-1.5">Current Value (USD)</label>
              <input
                type="number"
                name="currentValue"
                step="0.01"
                min="0"
                defaultValue={currentValue}
                required
                className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-sm mb-1.5">Cost Basis (USD)</label>
              <input
                type="number"
                name="costBasis"
                step="0.01"
                min="0"
                defaultValue={costBasis ?? ""}
                placeholder="Optional"
                className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-zinc-500 text-sm mb-1.5">Notes</label>
            <input
              type="text"
              name="notes"
              defaultValue={asset.notes || ""}
              placeholder="Serial number, purchase date..."
              className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Form>
      </motion.div>
    </div>
  );
}

function AssetCard({ asset }: { asset: ManualAsset }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const latestSnap = asset.snapshots[0];
  // Fall back to account.currentValue if no snapshot yet (e.g., just created, before first refresh)
  const currentValue = latestSnap
    ? Number(latestSnap.totalUsdValue)
    : asset.currentValue
    ? Number(asset.currentValue)
    : 0;
  const costBasis = asset.costBasis ? Number(asset.costBasis) : null;
  const gain = costBasis !== null ? currentValue - costBasis : null;
  const gainPct = costBasis && costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : null;

  const lastValued = latestSnap
    ? new Date(latestSnap.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <>
      <div className="flex gap-4 p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
          {asset.imagePath ? (
            <img
              src={`/api/asset-image/${asset.id}`}
              alt={asset.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="h-7 w-7 text-zinc-600" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-medium text-white text-sm">{asset.name}</span>
                {asset.category && <CategoryBadge category={asset.category} />}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-lg font-bold text-white">
                  ${currentValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {gain !== null && gainPct !== null && (
                  <span className={`flex items-center gap-1 text-xs font-medium ${gain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {gain >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {gain >= 0 ? "+" : ""}{gain.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0, style: "currency", currency: "USD" })} ({gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)
                  </span>
                )}
              </div>
              {lastValued && (
                <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                  <Clock className="h-3 w-3" />
                  <span>Last valued {lastValued}</span>
                </div>
              )}
              {asset.notes && (
                <p className="text-xs text-zinc-500 mt-1 truncate">{asset.notes}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="text-xs px-2 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                className="text-xs px-2 py-1 rounded-lg bg-zinc-700 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Delete confirm */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Delete this asset?</span>
                  <Form method="post" className="inline" onSubmit={() => setShowDeleteConfirm(false)}>
                    <input type="hidden" name="intent" value="delete-asset" />
                    <input type="hidden" name="accountId" value={asset.id} />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="text-xs px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                  </Form>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <EditAssetModal
            asset={asset}
            currentValue={currentValue}
            costBasis={costBasis}
            onClose={() => setShowEditModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function AddAssetForm() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAddAssetSubmitting = isSubmitting && navigation.formData?.get("intent") === "add-asset";

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  return (
    <Form method="post" encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="intent" value="add-asset" />

      {actionData && "error" in actionData && (
        <Alert variant="error">{actionData.error}</Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Asset Name" htmlFor="assetName">
          <Input
            id="assetName"
            name="assetName"
            type="text"
            required
            placeholder="Rolex Submariner, Tesla Model 3..."
          />
        </FormField>

        <FormField label="Category" htmlFor="category">
          <select
            id="category"
            name="category"
            required
            className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 cursor-pointer"
          >
            <option value="watches">Watches</option>
            <option value="cars">Cars</option>
          </select>
        </FormField>

        <FormField label="Current Value (USD)" htmlFor="currentValue">
          <Input
            id="currentValue"
            name="currentValue"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="15000"
          />
        </FormField>

        <FormField label="Cost Basis (USD, optional)" htmlFor="costBasis">
          <Input
            id="costBasis"
            name="costBasis"
            type="number"
            step="0.01"
            min="0"
            placeholder="12000"
          />
        </FormField>
      </div>

      <FormField label="Notes (optional)" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Serial number, purchase date, condition..."
          className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 resize-none text-sm"
        />
      </FormField>

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1.5">Photo (optional)</label>
        <div
          className="relative flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {imagePreview ? (
            <>
              <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
              <span className="text-sm text-zinc-400">Click to change</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-5 w-5 text-zinc-500" />
              <span className="text-sm text-zinc-500">Click to upload a photo</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            name="image"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>
      </div>

      <Button type="submit" className="w-full cursor-pointer" disabled={isAddAssetSubmitting}>
        <Plus className="h-4 w-4 mr-2" />
        {isAddAssetSubmitting ? "Adding..." : "Add Asset"}
      </Button>
    </Form>
  );
}

function PhysicalAssetsSection({ assets }: { assets: ManualAsset[] }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  // Close form on successful add
  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      if (navigation.state === "idle") {
        setShowAddForm(false);
      }
    }
  }, [actionData, navigation.state]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Physical Assets</h2>
          <p className="text-zinc-500 text-sm">
            {assets.length === 0
              ? "Track watches, cars, art, and other valuables"
              : `${assets.length} asset${assets.length === 1 ? "" : "s"} tracked`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Asset
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <h3 className="text-sm font-medium text-white mb-4">New Asset</h3>
              <AddAssetForm />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asset list */}
      {assets.length === 0 && !showAddForm ? (
        <div className="text-center py-10">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-zinc-600" />
          </div>
          <p className="text-zinc-500 text-sm">No physical assets yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {assets.map((asset, index) => (
              <motion.div
                key={asset.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <AssetCard asset={asset} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AccountsPage() {
  const { accounts, manualAssets } = useLoaderData<typeof loader>();
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
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Add Account Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <AddAccountForm onBankConnected={handleBankConnected} />
      </motion.div>

      {/* Physical Assets */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <PhysicalAssetsSection assets={manualAssets as ManualAsset[]} />
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
