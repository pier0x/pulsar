import { useState, useEffect, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { unstable_parseMultipartFormData, unstable_createMemoryUploadHandler, json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Plus, Trash2, Package, TrendingUp, TrendingDown, Clock, ImageIcon, X, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { Button, Input, FormField, Alert, Card } from "~/components/ui";
import { requireAuth } from "~/lib/auth";
import { prisma } from "~/lib/db.server";
import {
  createManualAsset,
  updateManualAssetValue,
  updateManualAssetDetails,
  deleteManualAsset,
} from "~/lib/accounts.server";

export const meta: MetaFunction = () => {
  return [{ title: "Pulsar" }];
};

// Recursively convert Prisma Decimal instances to plain numbers
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

  return json({ assets: serializeDecimals(manualAssets) });
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

    const account = await createManualAsset({
      userId: user.id,
      name: name.trim(),
      category: category.trim().toLowerCase(),
      currentValue,
      costBasis: costBasis && !isNaN(costBasis) ? costBasis : undefined,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : undefined,
    });

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

    const updates: Parameters<typeof updateManualAssetDetails>[1] = {};
    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (typeof category === "string" && category.trim()) updates.category = category.trim().toLowerCase();
    if (typeof notes === "string") updates.notes = notes.trim() || null;

    const costBasis = costBasisRaw && typeof costBasisRaw === "string" && costBasisRaw.trim()
      ? parseFloat(costBasisRaw)
      : undefined;
    if (costBasis !== undefined && !isNaN(costBasis)) updates.costBasis = costBasis;

    if (uploadedFile) {
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

// ---------------------------------------------------------------------------
// Components
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

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AssetsPage() {
  const { assets } = useLoaderData<typeof loader>();
  const [showAddForm, setShowAddForm] = useState(false);
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      if (navigation.state === "idle") {
        setShowAddForm(false);
      }
    }
  }, [actionData, navigation.state]);

  const typedAssets = assets as ManualAsset[];
  const totalValue = typedAssets.reduce((sum, a) => {
    const snap = a.snapshots[0];
    return sum + (snap ? Number(snap.totalUsdValue) : a.currentValue ? Number(a.currentValue) : 0);
  }, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Physical Assets</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {typedAssets.length === 0
              ? "Track watches, cars, art, and other valuables"
              : `${typedAssets.length} asset${typedAssets.length === 1 ? "" : "s"} · ${totalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors cursor-pointer"
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
            className="overflow-hidden"
          >
            <Card>
              <h3 className="text-sm font-medium text-white mb-4">New Asset</h3>
              <AddAssetForm />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asset list */}
      {typedAssets.length === 0 && !showAddForm ? (
        <Card>
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-zinc-600" />
            </div>
            <p className="text-zinc-400 font-medium mb-1">No physical assets yet</p>
            <p className="text-zinc-500 text-sm">Add your first one to start tracking its value.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {typedAssets.map((asset, index) => (
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
        </Card>
      )}
    </div>
  );
}
