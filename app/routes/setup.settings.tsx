import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { motion } from "framer-motion";
import { Button, Input, Select, SelectOption, FormField, Alert, Card } from "~/components/ui";
import { setSettings, SettingKeys } from "~/lib/settings.server";
import { requireSetupStep } from "~/lib/setup.server";
import { SetupSteps, TOTAL_SETUP_STEPS } from "~/lib/setup";

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
    { title: "Setup - Configure Settings" },
    { name: "description", content: "Configure your Pulsar settings" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSetupStep(SetupSteps.SETTINGS);
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSetupStep(SetupSteps.SETTINGS);

  const formData = await request.formData();
  const appName = formData.get("appName");
  const timezone = formData.get("timezone");

  if (typeof appName !== "string" || typeof timezone !== "string") {
    return json({ error: "Invalid form submission" }, { status: 400 });
  }

  if (!appName.trim()) {
    return json({ error: "App name is required" }, { status: 400 });
  }

  // Save settings
  await setSettings({
    [SettingKeys.APP_NAME]: appName.trim(),
    [SettingKeys.APP_TIMEZONE]: timezone,
  });

  // Move to API keys step
  return redirect("/setup/api-keys");
}

export default function SetupSettingsPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-zinc-500 text-sm mb-2">
              Step 2 of {TOTAL_SETUP_STEPS}
            </p>
            <h1 className="text-2xl font-bold text-white mb-2">
              Configure Settings
            </h1>
            <p className="text-zinc-400 text-sm">
              Set up your basic application preferences
            </p>
          </div>

          <Form method="post" className="space-y-5">
            {actionData?.error && (
              <Alert variant="error">{actionData.error}</Alert>
            )}

            <FormField
              label="Application Name"
              htmlFor="appName"
              hint="This name will be displayed throughout the app"
            >
              <Input
                id="appName"
                name="appName"
                type="text"
                required
                defaultValue="Pulsar"
                placeholder="Enter application name"
              />
            </FormField>

            <FormField
              label="Timezone"
              htmlFor="timezone"
              hint="Used for displaying dates and times"
            >
              <Select id="timezone" name="timezone" defaultValue="UTC">
                {TIMEZONES.map((tz) => (
                  <SelectOption key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectOption>
                ))}
              </Select>
            </FormField>

            <Button type="submit" disabled={isSubmitting} className="w-full mt-2">
              {isSubmitting ? "Saving..." : "Continue"}
            </Button>
          </Form>
        </Card>
      </motion.div>
    </div>
  );
}
