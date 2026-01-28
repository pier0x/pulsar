import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useFetcher } from "@remix-run/react";
import { motion } from "framer-motion";
import { Key, RefreshCw, Settings, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { Button, Input, FormField, Alert, Card, Select, SelectOption } from "~/components/ui";
import { requireAuth } from "~/lib/auth";
import {
  getRefreshesPerDay,
  setRefreshesPerDay,
  getTokenThresholdUsd,
  setTokenThresholdUsd,
  hasApiKey,
  setAlchemyApiKey,
  setHeliusApiKey,
  getLastScheduledRefresh,
  getUserTimezone,
  setUserTimezone,
  SettingKeys,
  type RefreshesPerDay,
} from "~/lib/settings.server";
import { testAlchemyConnection } from "~/lib/providers/alchemy.server";
import { testHeliusConnection } from "~/lib/providers/helius.server";
import { prisma } from "~/lib/db.server";

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

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  const [
    hasAlchemy,
    hasHelius,
    refreshesPerDay,
    tokenThreshold,
    lastRefresh,
    timezone,
  ] = await Promise.all([
    hasApiKey(user.id, SettingKeys.ALCHEMY_API_KEY),
    hasApiKey(user.id, SettingKeys.HELIUS_API_KEY),
    getRefreshesPerDay(user.id),
    getTokenThresholdUsd(user.id),
    getLastScheduledRefresh(user.id),
    getUserTimezone(user.id),
  ]);

  // Get recent refresh logs for this user's wallets
  const userWalletIds = await prisma.wallet.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  const recentRefreshes = await prisma.refreshLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 5,
    include: {
      errors: true,
    },
  });

  return json({
    hasAlchemy,
    hasHelius,
    refreshesPerDay,
    tokenThreshold,
    timezone,
    lastRefresh: lastRefresh?.toISOString() || null,
    recentRefreshes,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveApiKeys") {
    const alchemyKey = formData.get("alchemyKey");
    const heliusKey = formData.get("heliusKey");

    const results: { alchemy?: { success: boolean; error?: string }; helius?: { success: boolean; error?: string } } = {};

    // Test and save Alchemy key
    if (typeof alchemyKey === "string" && alchemyKey.trim()) {
      const test = await testAlchemyConnection(alchemyKey.trim());
      if (test.success) {
        await setAlchemyApiKey(user.id, alchemyKey.trim());
        results.alchemy = { success: true };
      } else {
        results.alchemy = { success: false, error: test.error };
      }
    }

    // Test and save Helius key
    if (typeof heliusKey === "string" && heliusKey.trim()) {
      const test = await testHeliusConnection(heliusKey.trim());
      if (test.success) {
        await setHeliusApiKey(user.id, heliusKey.trim());
        results.helius = { success: true };
      } else {
        results.helius = { success: false, error: test.error };
      }
    }

    return json({ intent: "saveApiKeys", results });
  }

  if (intent === "saveRefreshSettings") {
    const refreshesPerDayStr = formData.get("refreshesPerDay");
    const tokenThresholdStr = formData.get("tokenThreshold");

    if (typeof refreshesPerDayStr === "string") {
      const value = parseInt(refreshesPerDayStr, 10) as RefreshesPerDay;
      if ([1, 3, 5, 10].includes(value)) {
        await setRefreshesPerDay(user.id, value);
      }
    }

    if (typeof tokenThresholdStr === "string") {
      const value = parseFloat(tokenThresholdStr);
      if (!isNaN(value) && value >= 0) {
        await setTokenThresholdUsd(user.id, value);
      }
    }

    return json({ intent: "saveRefreshSettings", success: true });
  }

  if (intent === "savePreferences") {
    const timezone = formData.get("timezone");
    if (typeof timezone === "string") {
      await setUserTimezone(user.id, timezone);
    }
    return json({ intent: "savePreferences", success: true });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

function ApiKeyInput({
  id,
  name,
  label,
  placeholder,
  hasKey,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  hasKey: boolean;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <FormField 
      label={
        <span className="flex items-center gap-2">
          {label}
          {hasKey && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="h-3 w-3" />
              Configured
            </span>
          )}
        </span>
      } 
      htmlFor={id}
    >
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={showKey ? "text" : "password"}
          placeholder={hasKey ? "••••••••••••••••" : placeholder}
          className="pr-10 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
        >
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </FormField>
  );
}

export default function SettingsPage() {
  const { 
    hasAlchemy, 
    hasHelius, 
    refreshesPerDay, 
    tokenThreshold,
    timezone,
    lastRefresh,
    recentRefreshes,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const refreshFetcher = useFetcher();
  
  const isSubmitting = navigation.state === "submitting";
  const isRefreshing = refreshFetcher.state !== "idle";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Settings className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Preferences</h2>
              <p className="text-zinc-500 text-sm">
                Configure your display preferences
              </p>
            </div>
          </div>

          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="savePreferences" />

            {actionData && "intent" in actionData && actionData.intent === "savePreferences" && (
              <Alert variant="success">Preferences saved successfully</Alert>
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

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Preferences"}
            </Button>
          </Form>
        </Card>
      </motion.div>

      {/* API Keys */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Key className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">API Keys</h2>
              <p className="text-zinc-500 text-sm">
                Configure your blockchain API keys for balance fetching
              </p>
            </div>
          </div>

          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="saveApiKeys" />

            {actionData && "results" in actionData && (
              <div className="space-y-2">
                {actionData.results.alchemy && (
                  <Alert variant={actionData.results.alchemy.success ? "success" : "error"}>
                    Alchemy: {actionData.results.alchemy.success ? "Connected successfully" : actionData.results.alchemy.error}
                  </Alert>
                )}
                {actionData.results.helius && (
                  <Alert variant={actionData.results.helius.success ? "success" : "error"}>
                    Helius: {actionData.results.helius.success ? "Connected successfully" : actionData.results.helius.error}
                  </Alert>
                )}
              </div>
            )}

            <ApiKeyInput
              id="alchemyKey"
              name="alchemyKey"
              label="Alchemy API Key"
              placeholder="Enter your Alchemy API key"
              hasKey={hasAlchemy}
            />
            <p className="text-xs text-zinc-500 -mt-2">
              Used for Ethereum, Arbitrum, Base, Polygon, and Bitcoin. Get one at{" "}
              <a href="https://dashboard.alchemy.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                dashboard.alchemy.com
              </a>
            </p>

            <ApiKeyInput
              id="heliusKey"
              name="heliusKey"
              label="Helius API Key"
              placeholder="Enter your Helius API key"
              hasKey={hasHelius}
            />
            <p className="text-xs text-zinc-500 -mt-2">
              Used for Solana. Get one at{" "}
              <a href="https://dev.helius.xyz" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                dev.helius.xyz
              </a>
            </p>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Testing & Saving..." : "Save API Keys"}
            </Button>
          </Form>
        </Card>
      </motion.div>

      {/* Refresh Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <RefreshCw className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Refresh Settings</h2>
              <p className="text-zinc-500 text-sm">
                Configure how often balances are fetched
              </p>
            </div>
          </div>

          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="saveRefreshSettings" />

            {actionData && "intent" in actionData && actionData.intent === "saveRefreshSettings" && (
              <Alert variant="success">Settings saved successfully</Alert>
            )}

            <FormField label="Refresh Frequency" htmlFor="refreshesPerDay">
              <Select
                id="refreshesPerDay"
                name="refreshesPerDay"
                defaultValue={refreshesPerDay.toString()}
              >
                <SelectOption value="1">1x per day (every 24 hours)</SelectOption>
                <SelectOption value="3">3x per day (every 8 hours)</SelectOption>
                <SelectOption value="5">5x per day (every ~5 hours)</SelectOption>
                <SelectOption value="10">10x per day (every ~2.5 hours)</SelectOption>
              </Select>
            </FormField>

            <FormField 
              label="Minimum Token Value" 
              htmlFor="tokenThreshold"
              hint="Tokens below this USD value will be ignored"
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

          {/* Manual Refresh */}
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">Manual Refresh</h3>
                <p className="text-xs text-zinc-500">
                  {lastRefresh 
                    ? `Last refresh: ${new Date(lastRefresh).toLocaleString()}`
                    : "No refreshes yet"
                  }
                </p>
              </div>
              <refreshFetcher.Form method="post" action="/api/refresh">
                <Button 
                  type="submit" 
                  variant="secondary"
                  disabled={isRefreshing || !hasAlchemy}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                  {isRefreshing ? "Refreshing..." : "Refresh Now"}
                </Button>
              </refreshFetcher.Form>
            </div>
            {!hasAlchemy && (
              <p className="text-xs text-amber-400 mt-2">
                Configure at least the Alchemy API key to enable balance fetching
              </p>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Recent Refresh History */}
      {recentRefreshes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-zinc-500/10">
                <Settings className="h-5 w-5 text-zinc-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Recent Refreshes</h2>
                <p className="text-zinc-500 text-sm">
                  History of balance refresh attempts
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {recentRefreshes.map((refresh) => (
                <div
                  key={refresh.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"
                >
                  <div className="flex items-center gap-3">
                    {refresh.status === "success" ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : refresh.status === "partial_failure" ? (
                      <XCircle className="h-4 w-4 text-amber-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm text-white">
                        {refresh.walletsSucceeded}/{refresh.walletsAttempted} wallets
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(refresh.timestamp).toLocaleString()} · {refresh.trigger} · {refresh.durationMs}ms
                      </p>
                    </div>
                  </div>
                  {refresh.errors.length > 0 && (
                    <span className="text-xs text-red-400">
                      {refresh.errors.length} error{refresh.errors.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
