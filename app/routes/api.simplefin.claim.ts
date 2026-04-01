/**
 * POST /api/simplefin/claim
 *
 * Body (JSON): { setupToken: string }
 *
 * Claims a SimpleFIN Setup Token, creates a SimplefinConnection,
 * and creates Account entries for each account returned.
 *
 * Returns: { success, connectionLabel, accountsCreated }
 */

import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { requireAuth } from "~/lib/auth";
import { prisma } from "~/lib/db.server";
import { claimSetupToken } from "~/lib/providers/simplefin.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireAuth(request);

  let body: { setupToken?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { setupToken } = body;
  if (!setupToken || typeof setupToken !== "string" || !setupToken.trim()) {
    return json({ error: "setupToken is required" }, { status: 400 });
  }

  // 1. Claim the Setup Token → encrypted Access URL + accounts
  const claimResult = await claimSetupToken(setupToken.trim());
  if (!claimResult.success) {
    return json({ error: claimResult.error }, { status: 400 });
  }

  const { accessUrl: encryptedAccessUrl, label, accounts } = claimResult;

  // 2. Create SimplefinConnection in DB
  const connection = await prisma.simplefinConnection.create({
    data: {
      userId: user.id,
      accessUrl: encryptedAccessUrl,
      label,
      lastSynced: new Date(),
    },
  });

  // 3. Create Account entries for each SimpleFIN account
  // (Snapshots are created during the next refresh cycle, not on claim)
  let accountsCreated = 0;

  for (const sfAccount of accounts) {
    try {
      // Check for duplicates by simplefinAccountId
      const existing = await prisma.account.findFirst({
        where: { userId: user.id, simplefinAccountId: sfAccount.id },
      });
      if (existing) continue;

      await prisma.account.create({
        data: {
          userId: user.id,
          name: sfAccount.name,
          type: sfAccount.accountType,
          provider: "simplefin",
          simplefinConnectionId: connection.id,
          simplefinAccountId: sfAccount.id,
        },
      });

      accountsCreated++;
    } catch (err) {
      console.error("[simplefin] Failed to create account:", err);
    }
  }

  return json({
    success: true,
    connectionLabel: label,
    accountsCreated,
  });
}
