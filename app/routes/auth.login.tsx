import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useSearchParams } from "@remix-run/react";
import { AuthForm } from "~/components/auth/auth-form";
import { login, createLoginSession, redirectIfAuthenticated } from "~/lib/auth";
import { getSetupRedirect } from "~/lib/setup.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Sign In - Pulsar" },
    { name: "description", content: "Sign in to your Pulsar account" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if setup is complete first
  const setupRedirect = await getSetupRedirect();
  if (setupRedirect) {
    throw redirect(setupRedirect);
  }

  await redirectIfAuthenticated(request);
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo") || "/";

  if (typeof username !== "string" || typeof password !== "string") {
    return json({ error: "Invalid form submission" }, { status: 400 });
  }

  const result = await login(username, password);

  if (result.error || !result.user) {
    return json({ error: result.error || "Login failed" }, { status: 400 });
  }

  return createLoginSession(
    request,
    result.user.id,
    typeof redirectTo === "string" ? redirectTo : "/"
  );
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || undefined;

  return (
    <AuthForm
      error={actionData?.error}
      redirectTo={redirectTo}
    />
  );
}
