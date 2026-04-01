import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { Settings, Clock, Trash2, X, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input, FormField, Alert, Card, Select, SelectOption } from "~/components/ui";
import { requireAuth } from "~/lib/auth";
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
    { title: "Settings - Pulsar" },
    { name: "description", content: "Configure your Pulsar settings" },
  ];
};

// Recursively convert Prisma Decimal instances to plain numbers
function serializeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
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

const BADGE_COLORS: Record<string, string> = {
  onchain: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  bank: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  brokerage: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  manual: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
};

const TYPE_LABELS: Record<string, string> = {
  onchain: "on-chain",
  bank: "bank",
  brokerage: "brokerage",
  manual: "manual",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_COLORS[type] ?? "bg-zinc-700 text-zinc-300"}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function SnapshotItemDetail({ snapshot }: { snapshot: SnapshotItem }) {
  return (
    <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white truncate">{snapshot.account.name}</span>
        <TypeBadge type={snapshot.account.type} />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-400">Total value</span>
        <span className="text-white font-medium">{formatUsd(snapshot.totalUsdValue)}</span>
      </div>
      {snapshot.account.type === "onchain" && (
        <>
          {snapshot.nativeBalanceUsd != null && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Native (USD)</span>
              <span className="text-zinc-300">{formatUsd(snapshot.nativeBalanceUsd)}</span>
            </div>
          )}
          {snapshot.tokensUsdValue != null && snapshot.tokensUsdValue > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Tokens (USD)</span>
              <span className="text-zinc-300">{formatUsd(snapshot.tokensUsdValue)}</span>
            </div>
          )}
          {snapshot.tokenSnapshots.length > 0 && (
            <div className="pl-2 space-y-1 max-h-32 overflow-y-auto">
              {snapshot.tokenSnapshots.map((t) => (
                <div key={t.id} className="flex justify-between text-xs">
                  <span className="text-zinc-400">{t.symbol}</span>
                  <span className="text-zinc-500">{formatUsd(t.balanceUsd)}</span>
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
              <span className="text-zinc-400">Current balance</span>
              <span className="text-zinc-300">{formatUsd(snapshot.currentBalance)}</span>
            </div>
          )}
          {snapshot.availableBalance != null && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Available balance</span>
              <span className="text-zinc-300">{formatUsd(snapshot.availableBalance)}</span>
            </div>
          )}
        </>
      )}
      {snapshot.account.type === "brokerage" && (
        <>
          {snapshot.holdingsValue != null && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Holdings value</span>
              <span className="text-zinc-300">{formatUsd(snapshot.holdingsValue)}</span>
            </div>
          )}
          {snapshot.cashBalance != null && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Cash balance</span>
              <span className="text-zinc-300">{formatUsd(snapshot.cashBalance)}</span>
            </div>
          )}
          {snapshot.holdings.length > 0 && (
            <div className="pl-2 space-y-1 max-h-32 overflow-y-auto">
              {snapshot.holdings.map((h) => (
                <div key={h.id} className="flex justify-between text-xs">
                  <span className="text-zinc-400">{h.ticker}</span>
                  <span className="text-zinc-500">{formatUsd(h.valueUsd)}</span>
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
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        className="relative z-10 w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl max-h-[85vh] flex flex-col"
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        transition={{ duration: 0.15 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-white">Refresh Run</h3>
            <p className="text-zinc-500 text-sm mt-0.5">{formatTimestamp(group.timestamp)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary */}
        <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4 mb-4 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-zinc-500 text-xs mb-1">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-white">{formatUsd(group.totalValue)}</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-500 text-xs mb-1">Accounts</p>
              <p className="text-xl font-semibold text-white">{group.accountCount}</p>
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
        <div className="pt-3 border-t border-zinc-800 shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <p className="text-sm text-zinc-400 flex-1">
                Delete {group.accountCount} snapshot{group.accountCount !== 1 ? "s" : ""}?
              </p>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => onDelete(group)}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer"
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Settings Card */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Settings className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <p className="text-zinc-500 text-sm">Configure your preferences</p>
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
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

      {/* Refresh History */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Clock className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Refresh History</h2>
            <p className="text-zinc-500 text-sm">{groups.length} run{groups.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-6">
            No snapshots yet. Use the refresh button in the navbar to update your balances.
          </p>
        ) : (
          <div className="space-y-1">
            {groups.map((group) => (
              <div key={group.groupKey}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/60 transition-colors cursor-pointer group"
                  onClick={() => setSelectedGroup(group)}
                >
                  {/* Left: timestamp + account count */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{formatTimestamp(group.timestamp)}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {group.accountCount} account{group.accountCount !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Right: total value + actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-white">
                      {formatUsd(group.totalValue)}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedGroup(group); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
                      title="View details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleRowDeleteClick(e, group.groupKey)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
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
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 mb-1">
                        <p className="text-sm text-red-300 flex-1">
                          Delete {group.accountCount} snapshot{group.accountCount !== 1 ? "s" : ""}?
                        </p>
                        <button
                          onClick={() => setConfirmDeleteKey(null)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group)}
                          className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs transition-colors cursor-pointer"
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
