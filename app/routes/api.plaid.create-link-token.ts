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

  const result = await createLinkToken(user.id);

  if (!result.success) {
    return json({ error: result.error }, { status: 500 });
  }

  return json({
    linkToken: result.linkToken,
    expiration: result.expiration,
  });
}
