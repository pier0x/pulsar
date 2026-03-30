import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState, Fragment } from "react";
import { Settings, Trash2, Clock, AlertTriangle, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
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

interface RefreshLogWithErrors {
  id: string;
  timestamp: string;
  trigger: string;
  status: string;
  walletsAttempted: number;
  walletsSucceeded: number;
  walletsFailed: number;
  durationMs: number | null;
  errors: {
    id: string;
    network: string;
    walletAddress: string | null;
    errorType: string;
    errorMessage: string;
  }[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  const [tokenThreshold, timezone, refreshLogs] = await Promise.all([
    getTokenThresholdUsd(user.id),
    getUserTimezone(user.id),
    prisma.refreshLog.findMany({
      orderBy: { timestamp: "desc" },
      include: {
        errors: {
          select: {
            id: true,
            network: true,
            walletAddress: true,
            errorType: true,
            errorMessage: true,
          },
        },
      },
    }),
  ]);

  return json({ tokenThreshold, timezone, refreshLogs });
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
    const logId = formData.get("logId");
    if (typeof logId === "string") {
      await prisma.refreshLog.delete({ where: { id: logId } });
      return json({ deleted: true });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
    success: { icon: CheckCircle, color: "text-emerald-400 bg-emerald-400/10", label: "Success" },
    partial_failure: { icon: AlertTriangle, color: "text-amber-400 bg-amber-400/10", label: "Partial" },
    complete_failure: { icon: XCircle, color: "text-red-400 bg-red-400/10", label: "Failed" },
  };
  const c = config[status] || config.complete_failure;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${c.color}`}>
      <Icon className="size-3" />
      {c.label}
    </span>
  );
}

function TriggerBadge({ trigger }: { trigger: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
      trigger === "manual" ? "text-blue-400 bg-blue-400/10" : "text-zinc-400 bg-zinc-400/10"
    }`}>
      <Clock className="size-3" />
      {trigger === "manual" ? "Manual" : "Scheduled"}
    </span>
  );
}

export default function SettingsPage() {
  const { tokenThreshold, timezone, refreshLogs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [selectedLog, setSelectedLog] = useState<RefreshLogWithErrors | null>(null);

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

      {/* Snapshots Card */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Clock className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Refresh History</h2>
            <p className="text-zinc-500 text-sm">
              {refreshLogs.length} refresh{refreshLogs.length !== 1 ? "es" : ""} logged
            </p>
          </div>
        </div>

        {refreshLogs.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-8">No refresh logs yet</p>
        ) : (
          <div className="space-y-2">
            {refreshLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log as RefreshLogWithErrors)}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge status={log.status} />
                  <div className="min-w-0">
                    <div className="text-sm text-white">
                      {formatTimestamp(log.timestamp)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <TriggerBadge trigger={log.trigger} />
                      <span>
                        {log.walletsSucceeded}/{log.walletsAttempted} wallets
                      </span>
                      <span>·</span>
                      <span>{formatDuration(log.durationMs)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Form method="post" onClick={(e) => e.stopPropagation()}>
                    <input type="hidden" name="intent" value="deleteSnapshot" />
                    <input type="hidden" name="logId" value={log.id} />
                    <button
                      type="submit"
                      className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors rounded-md hover:bg-zinc-700/50 opacity-0 group-hover:opacity-100"
                      title="Delete log"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </Form>
                  <ChevronRight className="size-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Transition show={selectedLog !== null} as={Fragment}>
        <Dialog onClose={() => setSelectedLog(null)} className="relative z-50">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60" />
          </TransitionChild>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-lg rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl">
                {selectedLog && (
                  <>
                    <div className="px-5 py-4 border-b border-zinc-800">
                      <DialogTitle className="text-base font-semibold text-white">
                        Refresh Details
                      </DialogTitle>
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {formatTimestamp(selectedLog.timestamp)}
                      </p>
                    </div>

                    <div className="px-5 py-4 space-y-4">
                      {/* Summary */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-zinc-800/50 px-3 py-2">
                          <p className="text-xs text-zinc-500">Status</p>
                          <div className="mt-1"><StatusBadge status={selectedLog.status} /></div>
                        </div>
                        <div className="rounded-lg bg-zinc-800/50 px-3 py-2">
                          <p className="text-xs text-zinc-500">Trigger</p>
                          <div className="mt-1"><TriggerBadge trigger={selectedLog.trigger} /></div>
                        </div>
                        <div className="rounded-lg bg-zinc-800/50 px-3 py-2">
                          <p className="text-xs text-zinc-500">Wallets</p>
                          <p className="text-sm text-white mt-1">
                            {selectedLog.walletsSucceeded} ok · {selectedLog.walletsFailed} failed · {selectedLog.walletsAttempted} total
                          </p>
                        </div>
                        <div className="rounded-lg bg-zinc-800/50 px-3 py-2">
                          <p className="text-xs text-zinc-500">Duration</p>
                          <p className="text-sm text-white mt-1">{formatDuration(selectedLog.durationMs)}</p>
                        </div>
                      </div>

                      {/* Errors */}
                      {selectedLog.errors.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-white mb-2">
                            Errors ({selectedLog.errors.length})
                          </h3>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {selectedLog.errors.map((err) => (
                              <div key={err.id} className="rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-red-400 uppercase">{err.network}</span>
                                  {err.walletAddress && (
                                    <span className="text-xs text-zinc-500 font-mono">
                                      {err.walletAddress.length > 12
                                        ? `${err.walletAddress.slice(0, 6)}…${err.walletAddress.slice(-4)}`
                                        : err.walletAddress}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{err.errorType}</span>
                                  <span className="text-xs text-zinc-400 truncate">{err.errorMessage}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedLog.errors.length === 0 && (
                        <div className="text-center py-4">
                          <CheckCircle className="size-8 text-emerald-400 mx-auto mb-2" />
                          <p className="text-sm text-zinc-400">No errors — all wallets refreshed successfully</p>
                        </div>
                      )}
                    </div>

                    <div className="px-5 py-3 border-t border-zinc-800 flex justify-end">
                      <Button
                        type="button"
                        onClick={() => setSelectedLog(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
