import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-sm text-muted-foreground mb-2">
            Step 2 of {TOTAL_SETUP_STEPS}
          </div>
          <CardTitle className="text-2xl">Configure Settings</CardTitle>
          <CardDescription>
            Set up your basic application preferences
          </CardDescription>
        </CardHeader>

        <Form method="post">
          <CardContent className="space-y-4">
            {actionData?.error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                {actionData.error}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="appName"
                className="text-sm font-medium text-foreground"
              >
                Application Name
              </label>
              <Input
                id="appName"
                name="appName"
                type="text"
                required
                defaultValue="Pulsar"
                placeholder="Enter application name"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                This name will be displayed throughout the app
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="timezone"
                className="text-sm font-medium text-foreground"
              >
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                defaultValue="UTC"
                className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Used for displaying dates and times
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex gap-3">
            <Button
              type="submit"
              className="flex-1 h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Complete Setup"}
            </Button>
          </CardFooter>
        </Form>
      </Card>
    </div>
  );
}
