import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { motion } from "framer-motion";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { Button, Input, FormField, Alert, Card, Select, SelectOption } from "~/components/ui";
import { 
  setAlchemyApiKey, 
  setHeliusApiKey,
  setRefreshesPerDay,
  setTokenThresholdUsd,
  getRefreshesPerDay,
  getTokenThresholdUsd,
  hasApiKey,
  SettingKeys,
  type RefreshesPerDay,
} from "~/lib/settings.server";
import { requireSetupStep } from "~/lib/setup.server";
import { SetupSteps, TOTAL_SETUP_STEPS } from "~/lib/setup";
import { testAlchemyConnection } from "~/lib/providers/alchemy.server";
import { testHeliusConnection } from "~/lib/providers/helius.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Setup - API Keys" },
    { name: "description", content: "Configure your blockchain API keys" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSetupStep(SetupSteps.API_KEYS);
  
  const [hasAlchemy, hasHelius, refreshesPerDay, tokenThreshold] = await Promise.all([
    hasApiKey(SettingKeys.ALCHEMY_API_KEY),
    hasApiKey(SettingKeys.HELIUS_API_KEY),
    getRefreshesPerDay(),
    getTokenThresholdUsd(),
  ]);

  return json({ hasAlchemy, hasHelius, refreshesPerDay, tokenThreshold });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSetupStep(SetupSteps.API_KEYS);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "test") {
    const alchemyKey = formData.get("alchemyKey");
    const heliusKey = formData.get("heliusKey");

    const results: { 
      alchemy?: { success: boolean; error?: string }; 
      helius?: { success: boolean; error?: string };
    } = {};

    // Test Alchemy key
    if (typeof alchemyKey === "string" && alchemyKey.trim()) {
      const test = await testAlchemyConnection(alchemyKey.trim());
      if (test.success) {
        await setAlchemyApiKey(alchemyKey.trim());
        results.alchemy = { success: true };
      } else {
        results.alchemy = { success: false, error: test.error };
      }
    }

    // Test Helius key
    if (typeof heliusKey === "string" && heliusKey.trim()) {
      const test = await testHeliusConnection(heliusKey.trim());
      if (test.success) {
        await setHeliusApiKey(heliusKey.trim());
        results.helius = { success: true };
      } else {
        results.helius = { success: false, error: test.error };
      }
    }

    return json({ intent: "test", results });
  }

  if (intent === "continue") {
    // Save refresh settings
    const refreshesPerDayStr = formData.get("refreshesPerDay");
    const tokenThresholdStr = formData.get("tokenThreshold");

    if (typeof refreshesPerDayStr === "string") {
      const value = parseInt(refreshesPerDayStr, 10) as RefreshesPerDay;
      if ([1, 3, 5, 10].includes(value)) {
        await setRefreshesPerDay(value);
      }
    }

    if (typeof tokenThresholdStr === "string") {
      const value = parseFloat(tokenThresholdStr);
      if (!isNaN(value) && value >= 0) {
        await setTokenThresholdUsd(value);
      }
    }

    // Move to complete
    return redirect("/setup/complete");
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

function ApiKeyInput({
  id,
  name,
  label,
  placeholder,
  hasKey,
  hint,
  linkText,
  linkUrl,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  hasKey: boolean;
  hint: string;
  linkText: string;
  linkUrl: string;
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
      hint={
        <span>
          {hint}{" "}
          <a 
            href={linkUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-400 hover:underline"
          >
            {linkText}
          </a>
        </span>
      }
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

export default function SetupApiKeysPage() {
  const { hasAlchemy, hasHelius, refreshesPerDay, tokenThreshold } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const testResults = actionData && "results" in actionData ? actionData.results : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <Card className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-zinc-500 text-sm mb-2">
              Step 3 of {TOTAL_SETUP_STEPS}
            </p>
            <h1 className="text-2xl font-bold text-white mb-2">
              API Keys & Refresh Settings
            </h1>
            <p className="text-zinc-400 text-sm">
              Configure how Pulsar fetches your wallet balances
            </p>
          </div>

          <Form method="post" className="space-y-6">
            {testResults && (
              <div className="space-y-2">
                {testResults.alchemy && (
                  <Alert variant={testResults.alchemy.success ? "success" : "error"}>
                    Alchemy: {testResults.alchemy.success ? "Connected successfully!" : testResults.alchemy.error}
                  </Alert>
                )}
                {testResults.helius && (
                  <Alert variant={testResults.helius.success ? "success" : "error"}>
                    Helius: {testResults.helius.success ? "Connected successfully!" : testResults.helius.error}
                  </Alert>
                )}
              </div>
            )}

            {/* API Keys Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-300">API Keys</h3>
              
              <ApiKeyInput
                id="alchemyKey"
                name="alchemyKey"
                label="Alchemy API Key"
                placeholder="Enter your Alchemy API key"
                hasKey={hasAlchemy}
                hint="For Ethereum, Arbitrum, Base, Polygon & Bitcoin."
                linkText="Get one free →"
                linkUrl="https://dashboard.alchemy.com"
              />

              <ApiKeyInput
                id="heliusKey"
                name="heliusKey"
                label="Helius API Key"
                placeholder="Enter your Helius API key"
                hasKey={hasHelius}
                hint="For Solana."
                linkText="Get one free →"
                linkUrl="https://dev.helius.xyz"
              />

              <Button 
                type="submit" 
                name="intent" 
                value="test"
                variant="secondary"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Testing..." : "Test & Save Keys"}
              </Button>
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* Refresh Settings Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-300">Refresh Settings</h3>

              <FormField 
                label="Auto-Refresh Frequency" 
                htmlFor="refreshesPerDay"
                hint="How often to automatically update wallet balances"
              >
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
                label="Dust Threshold" 
                htmlFor="tokenThreshold"
                hint="Ignore tokens worth less than this amount"
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
            </div>

            {/* Continue Button */}
            <Button 
              type="submit" 
              name="intent" 
              value="continue"
              disabled={isSubmitting}
              className="w-full"
            >
              {hasAlchemy || hasHelius ? "Continue" : "Skip API Keys & Continue"}
            </Button>

            <p className="text-xs text-zinc-500 text-center">
              You can always change these later in Settings
            </p>
          </Form>
        </Card>
      </motion.div>
    </div>
  );
}
