import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { motion } from "framer-motion";
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

  // Move to complete
  return redirect("/setup/complete");
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
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8">
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
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl"
              >
                {actionData.error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="appName"
                className="text-sm font-medium text-zinc-300"
              >
                Application Name
              </label>
              <input
                id="appName"
                name="appName"
                type="text"
                required
                defaultValue="Pulsar"
                placeholder="Enter application name"
                className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
              />
              <p className="text-xs text-zinc-500">
                This name will be displayed throughout the app
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="timezone"
                className="text-sm font-medium text-zinc-300"
              >
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                defaultValue="UTC"
                className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value} className="bg-zinc-800">
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500">
                Used for displaying dates and times
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors mt-2"
            >
              {isSubmitting ? "Saving..." : "Complete Setup"}
            </button>
          </Form>
        </div>
      </motion.div>
    </div>
  );
}
