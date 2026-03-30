import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { motion } from "framer-motion";
import { prisma } from "~/lib/db.server";
import { hashPassword, validatePassword } from "~/lib/auth";
import { createLoginSession } from "~/lib/auth";
import { initializeUserSettings } from "~/lib/settings.server";
import { requireNoOwner } from "~/lib/onboard.server";
import { Button, Input, FormField, Alert } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Pulsar - Setup" },
    { name: "description", content: "Set up your Pulsar dashboard." },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireNoOwner();
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  await requireNoOwner();

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

  const trimmedUsername = username.trim().toLowerCase();

  if (!trimmedUsername || trimmedUsername.length < 3) {
    return json({ error: "Username must be at least 3 characters" }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return json({ error: "Passwords do not match" }, { status: 400 });
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return json({ error: passwordCheck.error }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username: trimmedUsername,
      passwordHash,
    },
  });

  await initializeUserSettings(user.id);

  return createLoginSession(request, user.id, "/");
}

export default function OnboardPage() {
  const fetcher = useFetcher<{ error?: string }>();
  const isSubmitting = fetcher.state === "submitting";
  const error = fetcher.data?.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome to Pulsar
            </h1>
            <p className="text-zinc-400 text-sm">
              Create your account to get started.
            </p>
          </div>

          <fetcher.Form method="post" className="space-y-5">
            {error && <Alert variant="error">{error}</Alert>}

            <FormField label="Username" htmlFor="username">
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Choose a username"
              />
            </FormField>

            <FormField label="Password" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Choose a password"
              />
            </FormField>

            <FormField label="Confirm Password" htmlFor="confirmPassword">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Confirm your password"
              />
            </FormField>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Setting up..." : "Set up Pulsar"}
            </Button>
          </fetcher.Form>
        </div>
      </motion.div>
    </div>
  );
}
