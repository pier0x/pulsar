import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { login, createLoginSession, redirectIfAuthenticated } from "~/lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  // If already authenticated, redirect to home
  await redirectIfAuthenticated(request);
  // Redirect to landing page - login is now a modal
  throw redirect("/");
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
