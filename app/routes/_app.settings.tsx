import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Settings } from "lucide-react";
import { Button, Input, FormField, Alert, Card, Select, SelectOption } from "~/components/ui";
import { requireAuth } from "~/lib/auth";
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

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  const [tokenThreshold, timezone] = await Promise.all([
    getTokenThresholdUsd(user.id),
    getUserTimezone(user.id),
  ]);

  return json({ tokenThreshold, timezone });
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

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function SettingsPage() {
  const { tokenThreshold, timezone } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl mx-auto">
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
    </div>
  );
}
