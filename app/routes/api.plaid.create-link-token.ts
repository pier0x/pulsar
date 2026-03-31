/**
 * POST /api/plaid/create-link-token
 * Creates a Plaid Link token for the authenticated user.
 */

import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { requireAuth } from "~/lib/auth";
import { createLinkToken } from "~/lib/providers/plaid.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireAuth(request);

  // Build redirect URI from the request origin (needed for OAuth banks in Production)
  // On Railway, request.url may use internal hostname — prefer X-Forwarded-Host
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const url = new URL(request.url);
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;
  const redirectUri = `${origin}/accounts`;

  const result = await createLinkToken(user.id, redirectUri);

  if (!result.success) {
    console.error("[plaid] createLinkToken failed:", result.error);
    return json({ error: result.error }, { status: 500 });
  }
  console.log("[plaid] link token created, redirectUri:", redirectUri);

  return json({
    linkToken: result.linkToken,
    expiration: result.expiration,
  });
}
