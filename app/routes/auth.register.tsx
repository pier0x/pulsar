import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";

// Registration is disabled — single-user app, owner already registered.

export async function loader({ request }: LoaderFunctionArgs) {
  throw redirect("/");
}

export async function action({ request }: ActionFunctionArgs) {
  return json({ error: "Registration is disabled" }, { status: 403 });
}
