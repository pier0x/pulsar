import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { Settings, Clock, Trash2, X, Eye, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input, FormField, Alert, Card, Select, SelectOption } from "~/components/ui";
import { requireAuth } from "~/lib/auth";
import { verifyPassword, hashPassword, validatePassword } from "~/lib/auth/password.server";
import { prisma } from "~/lib/db.server";
import {
  getTokenThresholdUsd,
  setTokenThresholdUsd,
  getUserTimezone,
  setUserTimezone,
} from "~/lib/settings.server";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Shanghai", label: "Shanghai" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Sydney" },
];

export const meta: MetaFunction = () => {
  return [
    { title: "Pulsar" },
  ];
};

// Recursively convert Prisma Decimal instances to plain numbers
function serializeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (typeof obj === "object" && "toFixed" in (obj as Record<string, unknown>) && "toNumber" in (obj as Record<string, unknown>)) {
    return Number((obj as unknown as { toNumber: () => number }).toNumber()) as unknown as T;
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

  const [tokenThreshold, timezone, snapshotsRaw] = await Promise.all([
    getTokenThresholdUsd(user.id),
    getUserTimezone(user.id),
    prisma.accountSnapshot.findMany({
      where: { account: { userId: user.id } },
      orderBy: { timestamp: "desc" },
      take: 200,
      include: {
        account: { select: { name: true, type: true, provider: true } },
        tokenSnapshots: { select: { id: true, symbol: true, balanceUsd: true } },
        holdings: { select: { id: true, ticker: true, valueUsd: true } },
      },
    }),
  ]);

  const snapshots = serializeDecimals(snapshotsRaw);

  // Group snapshots by runId (snapshots without runId get their own group keyed by id)
  type SnapshotRow = (typeof snapshots)[0];
  const groupMap = new Map<string, SnapshotRow[]>();
  for (const snap of snapshots) {
    const key = (snap as SnapshotRow & { runId?: string | null }).runId ?? snap.id;
    const existing = groupMap.get(key);
    if (existing) {
      existing.push(snap);
    } else {
      groupMap.set(key, [snap]);
    }
  }

  const snapshotGroups = Array.from(groupMap.entries()).map(([key, snaps]) => {
    const first = snaps[0] as SnapshotRow & { runId?: string | null };
    const totalValue = snaps.reduce((sum, s) => sum + Number((s as SnapshotRow).totalUsdValue), 0);
    return {
      runId: first.runId ?? null,
      groupKey: key,
      timestamp: first.timestamp,
      totalValue,
      accountCount: snaps.length,
      snapshots: snaps,
    };
  });

  return json({ tokenThreshold, timezone, snapshotGroups });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveSettings") {
    const timezone = formData.get("timezone");
    const tokenThresholdStr = formData.get("tokenThreshold");

    if (typeof timezone === "string") {
      await setUserTimezone(user.id, timezone);
    }

    if (typeof tokenThresholdStr === "string") {
      const value = parseFloat(tokenThresholdStr);
      if (!isNaN(value) && value >= 0) {
        await setTokenThresholdUsd(user.id, value);
      }
    }

    return json({ success: true });
  }

  if (intent === "changePassword") {
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      return json({ passwordError: "All fields are required" }, { status: 400 });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return json({ passwordError: "All fields are required" }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return json({ passwordError: "New passwords don't match" }, { status: 400 });
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return json({ passwordError: validation.error }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return json({ passwordError: "User not found" }, { status: 404 });
    }

    const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!isValid) {
      return json({ passwordError: "Current password is incorrect" }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return json({ passwordSuccess: true });
  }

  if (intent === "deleteSnapshot") {
    const snapshotId = formData.get("snapshotId");
    const runId = formData.get("runId");

    if (typeof runId === "string" && runId) {
      // Delete all snapshots in this run (verify ownership first)
      const count = await prisma.accountSnapshot.count({
        where: { runId, account: { userId: user.id } },
      });
      if (count === 0) {
        return json({ error: "Run not found or access denied" }, { status: 404 });
      }
      await prisma.accountSnapshot.deleteMany({ where: { runId } });
      return json({ deleted: true });
    }

    if (typeof snapshotId !== "string") {
      return json({ error: "Missing snapshotId or runId" }, { status: 400 });
    }

    // Legacy: delete individual snapshot
    const snapshot = await prisma.accountSnapshot.findFirst({
      where: { id: snapshotId, account: { userId: user.id } },
    });

    if (!snapshot) {
      return json({ error: "Snapshot not found or access denied" }, { status: 404 });
    }

    // Cascade handled by Prisma schema (onDelete: Cascade on tokenSnapshots and holdings)
    await prisma.accountSnapshot.delete({ where: { id: snapshotId } });

    return json({ deleted: true });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

type SnapshotItem = {
  id: string;
  runId?: string | null;
  timestamp: string;
  totalUsdValue: number;
  nativeBalance: string | null;
  nativeBalanceUsd: number | null;
  tokensUsdValue: number | null;
  availableBalance: number | null;
  currentBalance: number | null;
  holdingsValue: number | null;
  cashBalance: number | null;
  account: { name: string; type: string; provider: string };
  tokenSnapshots: { id: string; symbol: string; balanceUsd: number }[];
  holdings: { id: string; ticker: string; valueUsd: number }[];
};

type SnapshotGroup = {
  runId: string | null;
  groupKey: string;
  timestamp: string;
  totalValue: number;
  accountCount: number;
  snapshots: SnapshotItem[];
};

function formatUsd(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const TYPE_VARIANT: Record<string, "default" | "active" | "success" | "warning" | "destructive"> = {
  onchain: "active",
  bank: "success",
  brokerage: "default",
  manual: "warning",
};

const TYPE_LABELS: Record<string, string> = {
  onchain: "on-chain",
  bank: "bank",
  brokerage: "brokerage",
  manual: "manual",
};

function TypeBadge({ type }: { type: string }) {
  const variant = TYPE_VARIANT[type] ?? "default";
  return (
    <span className={`text-label px-2 py-0.5 rounded-md border ${
      variant === "active" ? "border-nd-border-visible text-nd-text-secondary" :
      variant === "success" ? "border-nd-success/30 text-nd-success" :
      variant === "warning" ? "border-nd-warning/30 text-nd-warning" :
      "border-nd-border text-nd-text-disabled"
    }`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function SnapshotItemDetail({ snapshot }: { snapshot: SnapshotItem }) {
  return (
    <div className="rounded-[12px] bg-nd-surface-raised border border-nd-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-nd-text-primary truncate">{snapshot.account.name}</span>
        <TypeBadge type={snapshot.account.type} />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-nd-text-secondary">Total value</span>
        <span className="text-nd-text-primary font-mono font-medium">{formatUsd(snapshot.totalUsdValue)}</span>
      </div>
      {snapshot.account.type === "onchain" && (
        <>
          {snapshot.nativeBalanceUsd != null && (
            <div className="flex justify-between text-sm">
              <span className="text-nd-text-secondary">Native (USD)</span>
              <span className="text-nd-text-secondary font-mono">{formatUsd(snapshot.nativeBalanceUsd)}</span>
            </div>
          )}
          {snapshot.tokensUsdValue != null && snapshot.tokensUsdValue > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-nd-text-secondary">Tokens (USD)</span>
              <span className="text-nd-text-secondary font-mono">{formatUsd(snapshot.tokensUsdValue)}</span>
            </div>
          )}
          {snapshot.tokenSnapshots.length > 0 && (
            <div className="pl-2 space-y-1 max-h-32 overflow-y-auto">
              {snapshot.tokenSnapshots.map((t) => (
                <div key={t.id} className="flex justify-between text-xs">
                  <span className="text-nd-text-secondary font-mono">{t.symbol}</span>
                  <span className="text-nd-text-disabled font-mono">{formatUsd(t.balanceUsd)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {snapshot.account.type === "bank" && (
        <>
          {snapshot.currentBalance != null && (
            <div className="flex justify-between text-sm">
              <span className="text-nd-text-secondary">Current balance</span>
              <span className="text-nd-text-secondary font-mono">{formatUsd(snapshot.currentBalance)}</span>
            </div>
          )}
          {snapshot.availableBalance != null && (
            <div className="flex justify-between text-sm">
              <span className="text-nd-text-secondary">Available balance</span>
              <span className="text-nd-text-secondary font-mono">{formatUsd(snapshot.availableBalance)}</span>
            </div>
          )}
        </>
      )}
      {snapshot.account.type === "brokerage" && (
        <>
          {snapshot.holdingsValue != null && (
            <div className="flex justify-between text-sm">
              <span className="text-nd-text-secondary">Holdings value</span>
              <span className="text-nd-text-secondary font-mono">{formatUsd(snapshot.holdingsValue)}</span>
            </div>
          )}
          {snapshot.cashBalance != null && (
            <div className="flex justify-between text-sm">
              <span className="text-nd-text-secondary">Cash balance</span>
              <span className="text-nd-text-secondary font-mono">{formatUsd(snapshot.cashBalance)}</span>
            </div>
          )}
          {snapshot.holdings.length > 0 && (
            <div className="pl-2 space-y-1 max-h-32 overflow-y-auto">
              {snapshot.holdings.map((h) => (
                <div key={h.id} className="flex justify-between text-xs">
                  <span className="text-nd-text-secondary font-mono">{h.ticker}</span>
                  <span className="text-nd-text-disabled font-mono">{formatUsd(h.valueUsd)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RunGroupModal({
  group,
  onClose,
  onDelete,
}: {
  group: SnapshotGroup;
  onClose: () => void;
  onDelete: (group: SnapshotGroup) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Modal */}
      <motion.div
        className="relative z-10 w-full max-w-lg rounded-[16px] bg-nd-surface border border-nd-border-visible p-6 max-h-[85vh] flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <h3 className="text-subheading text-nd-text-display">Refresh Run</h3>
            <p className="text-nd-text-disabled text-sm mt-0.5">{formatTimestamp(group.timestamp)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-nd-surface-raised text-nd-text-secondary hover:text-nd-text-primary transition-nd cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary */}
        <div className="rounded-[12px] bg-nd-surface-raised border border-nd-border p-4 mb-4 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-label text-nd-text-disabled mb-1">Total Portfolio Value</p>
              <p className="text-heading text-nd-text-display font-mono">{formatUsd(group.totalValue)}</p>
            </div>
            <div className="text-right">
              <p className="text-label text-nd-text-disabled mb-1">Accounts</p>
              <p className="text-subheading text-nd-text-display font-mono">{group.accountCount}</p>
            </div>
          </div>
        </div>

        {/* Snapshots list */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-4 min-h-0">
          {group.snapshots.map((snap) => (
            <SnapshotItemDetail key={snap.id} snapshot={snap} />
          ))}
        </div>

        {/* Delete */}
        <div className="pt-3 border-t border-nd-border shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <p className="text-sm text-nd-text-secondary flex-1">
                Delete {group.accountCount} snapshot{group.accountCount !== 1 ? "s" : ""}?
              </p>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-md bg-nd-surface-raised hover:bg-nd-surface border border-nd-border text-nd-text-secondary text-sm transition-nd cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => onDelete(group)}
                className="px-3 py-1.5 rounded-md bg-nd-accent hover:bg-nd-accent/80 text-nd-text-display text-sm transition-nd cursor-pointer"
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm text-nd-accent hover:text-nd-accent/80 transition-nd cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Delete run ({group.accountCount} snapshot{group.accountCount !== 1 ? "s" : ""})
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SettingsPage() {
  const { tokenThreshold, timezone, snapshotGroups } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";

  const [selectedGroup, setSelectedGroup] = useState<SnapshotGroup | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  function handleDeleteGroup(group: SnapshotGroup) {
    setSelectedGroup(null);
    setConfirmDeleteKey(null);
    const fd = new FormData();
    fd.set("intent", "deleteSnapshot");
    if (group.runId) {
      fd.set("runId", group.runId);
    } else {
      // Legacy: single snapshot, delete by id
      fd.set("snapshotId", group.snapshots[0].id);
    }
    submit(fd, { method: "post" });
  }

  function handleRowDeleteClick(e: React.MouseEvent, groupKey: string) {
    e.stopPropagation();
    setConfirmDeleteKey(confirmDeleteKey === groupKey ? null : groupKey);
  }

  const groups = snapshotGroups as unknown as SnapshotGroup[];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Settings Card */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-md bg-nd-surface-raised">
            <Settings className="h-5 w-5 text-nd-text-secondary" />
          </div>
          <div>
            <h2 className="text-subheading text-nd-text-display">Settings</h2>
            <p className="text-nd-text-disabled text-sm">Configure your preferences</p>
          </div>
        </div>

        <Form method="post" className="space-y-5">
          <input type="hidden" name="intent" value="saveSettings" />

          {actionData && "success" in actionData && (
            <Alert variant="success">Settings saved</Alert>
          )}

          <FormField label="Timezone" htmlFor="timezone">
            <Select id="timezone" name="timezone" defaultValue={timezone}>
              {TIMEZONES.map((tz) => (
                <SelectOption key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectOption>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Minimum Token Value"
            htmlFor="tokenThreshold"
            hint="Tokens below this USD value will be hidden"
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nd-text-disabled">$</span>
              <Input
                id="tokenThreshold"
                name="tokenThreshold"
                type="number"
                step="0.01"
                min="0"
                defaultValue={tokenThreshold}
                className="pl-7"
              />
            </div>
          </FormField>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Settings"}
          </Button>
        </Form>
      </Card>

      {/* Change Password */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-md bg-nd-surface-raised">
            <Lock className="h-5 w-5 text-nd-text-secondary" />
          </div>
          <div>
            <h2 className="text-subheading text-nd-text-display">Change Password</h2>
            <p className="text-nd-text-disabled text-sm">Update your account password</p>
          </div>
        </div>

        <Form method="post" className="space-y-5">
          <input type="hidden" name="intent" value="changePassword" />

          {actionData && "passwordError" in actionData && (
            <Alert variant="error">{(actionData as { passwordError: string }).passwordError}</Alert>
          )}
          {actionData && "passwordSuccess" in actionData && (
            <Alert variant="success">Password updated successfully</Alert>
          )}

          <FormField label="Current Password" htmlFor="currentPassword">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </FormField>

          <FormField label="New Password" htmlFor="newPassword">
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </FormField>

          <FormField label="Confirm New Password" htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </FormField>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Password"}
          </Button>
        </Form>
      </Card>

      {/* Refresh History */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-md bg-nd-surface-raised">
            <Clock className="h-5 w-5 text-nd-text-secondary" />
          </div>
          <div>
            <h2 className="text-subheading text-nd-text-display">Refresh History</h2>
            <p className="text-nd-text-disabled text-sm">{groups.length} run{groups.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="text-nd-text-disabled text-sm text-center py-6">
            No snapshots yet. Use the refresh button in the navbar to update your balances.
          </p>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.groupKey}>
                <div
                  className="flex items-center gap-4 px-4 py-3.5 rounded-[12px] bg-nd-surface-raised border border-nd-border hover:border-nd-border-visible hover:bg-nd-surface transition-nd cursor-pointer group"
                  onClick={() => setSelectedGroup(group)}
                >
                  {/* Left: timestamp + account count */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-nd-text-primary font-medium">{formatTimestamp(group.timestamp)}</p>
                    <p className="text-label text-nd-text-disabled mt-1">
                      {group.accountCount} account{group.accountCount !== 1 ? "s" : ""} refreshed
                    </p>
                  </div>

                  {/* Right: total value + actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-mono font-semibold text-nd-text-display">
                      {formatUsd(group.totalValue)}
                    </span>
                    <button
                      onClick={(e) => handleRowDeleteClick(e, group.groupKey)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-nd-accent-subtle text-nd-text-disabled hover:text-nd-accent transition-nd cursor-pointer"
                      title="Delete run"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline confirm */}
                <AnimatePresence>
                  {confirmDeleteKey === group.groupKey && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-nd-accent-subtle border border-nd-accent/20 mb-1">
                        <p className="text-sm text-nd-accent flex-1">
                          Delete {group.accountCount} snapshot{group.accountCount !== 1 ? "s" : ""}?
                        </p>
                        <button
                          onClick={() => setConfirmDeleteKey(null)}
                          className="px-2.5 py-1 rounded-md bg-nd-surface-raised hover:bg-nd-surface border border-nd-border text-nd-text-secondary text-xs transition-nd cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group)}
                          className="px-2.5 py-1 rounded-md bg-nd-accent hover:bg-nd-accent/80 text-nd-text-display text-xs transition-nd cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Run Group Modal */}
      <AnimatePresence>
        {selectedGroup && (
          <RunGroupModal
            group={selectedGroup}
            onClose={() => setSelectedGroup(null)}
            onDelete={handleDeleteGroup}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
