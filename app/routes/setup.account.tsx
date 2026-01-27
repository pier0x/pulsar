import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { motion } from "framer-motion";
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
              Step 1 of {TOTAL_SETUP_STEPS}
            </p>
            <h1 className="text-2xl font-bold text-white mb-2">
              Create Admin Account
            </h1>
            <p className="text-zinc-400 text-sm">
              Set up your administrator account to manage Pulsar
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
                htmlFor="username"
                className="text-sm font-medium text-zinc-300"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Choose a username"
                className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-zinc-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Choose a strong password"
                className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-zinc-300"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Confirm your password"
                className="w-full h-11 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors mt-2"
            >
              {isSubmitting ? "Creating account..." : "Continue"}
            </button>
          </Form>
        </div>
      </motion.div>
    </div>
  );
}
