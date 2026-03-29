import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { login, createLoginSession, redirectIfAuthenticated } from "~/lib/auth";
import { requireOwnerOrOnboard } from "~/lib/onboard.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOwnerOrOnboard();
  await redirectIfAuthenticated(request);
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
