import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData } from "@remix-run/react";
import { AuthForm } from "~/components/auth/auth-form";
import { register, createLoginSession, redirectIfAuthenticated } from "~/lib/auth";

export const meta: MetaFunction = () => {
  return [
    { title: "Create Account - Pulsar" },
    { name: "description", content: "Create a new Pulsar account" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await redirectIfAuthenticated(request);
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
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
    return json({ error: result.error || "Registration failed" }, { status: 400 });
  }

  // Automatically log in after registration
  return createLoginSession(request, result.user.id, "/");
}

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();

  return <AuthForm mode="register" error={actionData?.error} />;
}
