/**
 * API endpoint for manually triggering balance refresh
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAuth } from "~/lib/auth";
import {
  forceRefreshBalances,
  getRefreshStatus,
} from "~/lib/jobs/balance-refresh.server";

/**
 * GET: Get current refresh status
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await requireAuth(request);

  const status = await getRefreshStatus();

  return json({
    status: "ok",
    data: status,
  });
}

/**
 * POST: Trigger a manual balance refresh
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireAuth(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const result = await forceRefreshBalances();

  if (result.success) {
    const status = await getRefreshStatus();
    return json({
      status: "ok",
      message: "Balances refreshed successfully",
      data: status,
    });
  } else {
    return json(
      {
        status: "error",
        message: result.error || "Failed to refresh balances",
      },
      { status: 500 }
    );
  }
}
