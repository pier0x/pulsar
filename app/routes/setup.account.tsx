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
import { register } from "~/lib/auth";
import { setSetupStep } from "~/lib/settings.server";
import { requireSetupStep } from "~/lib/setup.server";
import { SetupSteps, TOTAL_SETUP_STEPS } from "~/lib/setup";

export const meta: MetaFunction = () => {
  return [
    { title: "Setup - Create Admin Account" },
    { name: "description", content: "Create your admin account to get started" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSetupStep(SetupSteps.ACCOUNT);

  // If a user already exists (e.g., setup was interrupted), skip to settings
  const { prisma } = await import("~/lib/db.server");
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    const { setSetupStep } = await import("~/lib/settings.server");
    await setSetupStep(SetupSteps.SETTINGS);
    throw redirect("/setup/settings");
  }

  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSetupStep(SetupSteps.ACCOUNT);

  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return json({ error: "Invalid form submission" }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return json({ error: "Passwords do not match" }, { status: 400 });
  }

  const result = await register(username, password);

  if (result.error || !result.user) {
    return json({ error: result.error || "Failed to create account" }, { status: 400 });
  }

  // Move to next step
  await setSetupStep(SetupSteps.SETTINGS);

  return redirect("/setup/settings");
}

export default function SetupAccountPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-sm text-muted-foreground mb-2">
            Step 1 of {TOTAL_SETUP_STEPS}
          </div>
          <CardTitle className="text-2xl">Create Admin Account</CardTitle>
          <CardDescription>
            Set up your administrator account to manage Pulsar
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
                htmlFor="username"
                className="text-sm font-medium text-foreground"
              >
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Choose a username"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Choose a strong password"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-foreground"
              >
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Confirm your password"
                className="h-11"
              />
            </div>
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              className="w-full h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Continue"}
            </Button>
          </CardFooter>
        </Form>
      </Card>
    </div>
  );
}
