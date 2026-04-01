import { useState, useEffect, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { unstable_parseMultipartFormData, unstable_createMemoryUploadHandler, json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Plus, Trash2, Package, TrendingUp, TrendingDown, Clock, ImageIcon, X, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { Button, Input, FormField, Alert, Card, Badge } from "~/components/ui";
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
    <Badge variant="warning">
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </Badge>
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
      <div className="absolute inset-0 bg-black/80" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-md rounded-[16px] bg-nd-surface border border-nd-border-visible p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-subheading text-nd-text-display">Edit Asset</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-nd-surface-raised text-nd-text-secondary hover:text-nd-text-primary transition-nd cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Form method="post" encType="multipart/form-data" className="space-y-4" onSubmit={onClose}>
          <input type="hidden" name="intent" value="update-asset" />
          <input type="hidden" name="accountId" value={asset.id} />

          <div className="flex justify-center">
            <label className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-[12px] bg-nd-surface-raised border border-nd-border flex items-center justify-center overflow-hidden group-hover:border-nd-border-visible transition-nd">
                {imagePreview ? (
                  <img src={imagePreview} alt="Asset" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-nd-text-disabled" />
                )}
              </div>
              <div className="absolute inset-0 rounded-[12px] flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-nd">
                <Pencil className="h-4 w-4 text-nd-text-primary" />
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
            <label className="block text-label text-nd-text-disabled mb-1.5">Name</label>
            <input
              type="text"
              name="assetName"
              defaultValue={asset.name}
              required
              className="w-full h-11 px-4 rounded-[12px] bg-nd-surface-raised border border-nd-border text-nd-text-primary placeholder:text-nd-text-disabled focus:outline-none focus:border-nd-border-visible"
            />
          </div>

          <div>
            <label className="block text-label text-nd-text-disabled mb-1.5">Category</label>
            <select
              name="category"
              defaultValue={asset.category || "watches"}
              required
              className="w-full h-11 px-4 rounded-[12px] bg-nd-surface-raised border border-nd-border text-nd-text-primary focus:outline-none focus:border-nd-border-visible cursor-pointer"
            >
              <option value="watches">Watches</option>
              <option value="cars">Cars</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-label text-nd-text-disabled mb-1.5">Current Value (USD)</label>
              <input
                type="number"
                name="currentValue"
                step="0.01"
                min="0"
                defaultValue={currentValue}
                required
                className="w-full h-11 px-4 rounded-[12px] bg-nd-surface-raised border border-nd-border text-nd-text-primary placeholder:text-nd-text-disabled focus:outline-none focus:border-nd-border-visible font-mono"
              />
            </div>
            <div>
              <label className="block text-label text-nd-text-disabled mb-1.5">Cost Basis (USD)</label>
              <input
                type="number"
                name="costBasis"
                step="0.01"
                min="0"
                defaultValue={costBasis ?? ""}
                placeholder="Optional"
                className="w-full h-11 px-4 rounded-[12px] bg-nd-surface-raised border border-nd-border text-nd-text-primary placeholder:text-nd-text-disabled focus:outline-none focus:border-nd-border-visible font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-label text-nd-text-disabled mb-1.5">Notes</label>
            <input
              type="text"
              name="notes"
              defaultValue={asset.notes || ""}
              placeholder="Serial number, purchase date..."
              className="w-full h-11 px-4 rounded-[12px] bg-nd-surface-raised border border-nd-border text-nd-text-primary placeholder:text-nd-text-disabled focus:outline-none focus:border-nd-border-visible"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 cursor-pointer"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
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
      <div className="p-4 rounded-[12px] bg-nd-surface-raised hover:bg-nd-surface border border-nd-border transition-nd">
        {/* Top row: image + name/category + actions */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[8px] bg-nd-surface border border-nd-border flex items-center justify-center shrink-0 overflow-hidden">
            {asset.imagePath ? (
              <img
                src={`/api/asset-image/${asset.id}`}
                alt={asset.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-6 w-6 text-nd-text-disabled" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <span className="font-medium text-nd-text-primary text-sm sm:text-base block truncate">{asset.name}</span>
            {asset.category && <CategoryBadge category={asset.category} />}
          </div>

          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="text-label px-2 py-1 rounded-md bg-nd-surface hover:bg-nd-surface-raised border border-nd-border text-nd-text-secondary hover:text-nd-text-primary transition-nd cursor-pointer"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="text-label px-2 py-1 rounded-md bg-nd-surface hover:bg-nd-accent-subtle border border-nd-border text-nd-text-secondary hover:text-nd-accent transition-nd cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Value row */}
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className="font-mono text-[20px] sm:text-[24px] text-nd-text-display">
            ${currentValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {gain !== null && gainPct !== null && (
            <span className={`flex items-center gap-1 font-mono text-[12px] ${gain >= 0 ? "text-nd-success" : "text-nd-accent"}`}>
              {gain >= 0 ? "↑" : "↓"} {gain >= 0 ? "+" : ""}{gain.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0, style: "currency", currency: "USD" })} ({gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {lastValued && (
            <span className="text-label text-nd-text-disabled flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastValued}
            </span>
          )}
          {asset.notes && (
            <span className="text-label text-nd-text-disabled truncate">{asset.notes}</span>
          )}
        </div>

        {/* Delete confirm */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mt-3 pt-3 border-t border-nd-border overflow-hidden"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-label text-nd-text-secondary">Delete this asset?</span>
                <Form method="post" className="inline" onSubmit={() => setShowDeleteConfirm(false)}>
                  <input type="hidden" name="intent" value="delete-asset" />
                  <input type="hidden" name="accountId" value={asset.id} />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="text-label px-2 py-1 rounded-md bg-nd-accent-subtle hover:bg-nd-accent text-nd-accent hover:text-nd-text-display transition-nd cursor-pointer"
                  >
                    Confirm
                  </button>
                </Form>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-label text-nd-text-disabled hover:text-nd-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
            className="w-full h-11 px-4 rounded-[12px] bg-nd-surface-raised border border-nd-border text-nd-text-primary focus:outline-none focus:border-nd-border-visible cursor-pointer"
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
          className="w-full px-4 py-3 rounded-[12px] bg-nd-surface-raised border border-nd-border text-nd-text-primary placeholder:text-nd-text-disabled focus:outline-none focus:border-nd-border-visible resize-none text-sm"
        />
      </FormField>

      <div>
        <label className="block text-label text-nd-text-secondary mb-1.5">Photo (optional)</label>
        <div
          className="relative flex items-center justify-center gap-3 p-4 rounded-[12px] border-2 border-dashed border-nd-border hover:border-nd-border-visible cursor-pointer transition-nd"
          onClick={() => fileInputRef.current?.click()}
        >
          {imagePreview ? (
            <>
              <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-md object-cover" />
              <span className="text-sm text-nd-text-secondary">Click to change</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-5 w-5 text-nd-text-disabled" />
              <span className="text-sm text-nd-text-disabled">Click to upload a photo</span>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-nd-text-display">Physical Assets</h1>
          <p className="text-nd-text-disabled text-sm mt-1">
            {typedAssets.length === 0
              ? "Track watches, cars, art, and other valuables"
              : `${typedAssets.length} asset${typedAssets.length === 1 ? "" : "s"} · ${totalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}`}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
      </div>

      {/* Add form */}
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
              <h3 className="text-label text-nd-text-secondary mb-4">NEW ASSET</h3>
              <AddAssetForm />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asset list */}
      {typedAssets.length === 0 && !showAddForm ? (
        <Card>
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-nd-surface-raised border border-nd-border flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-nd-text-disabled" />
            </div>
            <p className="text-nd-text-secondary font-medium mb-1">No physical assets yet</p>
            <p className="text-nd-text-disabled text-sm">Add your first one to start tracking its value.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {typedAssets.map((asset) => (
                <motion.div
                  key={asset.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
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
