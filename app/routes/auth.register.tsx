import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { register, createLoginSession, redirectIfAuthenticated } from "~/lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  // If already authenticated, redirect to home
  await redirectIfAuthenticated(request);
  // Redirect to landing page - register is now a modal
  throw redirect("/");
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");
  const redirectTo = formData.get("redirectTo") || "/";

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

  // Log the user in after registration
  return createLoginSession(
    request,
    result.user.id,
    typeof redirectTo === "string" ? redirectTo : "/"
  );
}
