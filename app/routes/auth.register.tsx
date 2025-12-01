import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

/**
 * Registration is only available during initial setup.
 * After setup is complete, redirect to login.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return redirect("/auth/login");
}

export default function RegisterPage() {
  return null;
}
