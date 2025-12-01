import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { logout } from "~/lib/auth";

/**
 * Logout should only be accessible via POST to prevent CSRF attacks
 */
export async function loader(_args: LoaderFunctionArgs) {
  return redirect("/auth/login");
}

export async function action({ request }: ActionFunctionArgs) {
  return logout(request);
}
