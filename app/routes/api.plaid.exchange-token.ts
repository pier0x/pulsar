/**
 * POST /api/plaid/exchange-token
 *
 * Body (JSON):
 *   { publicToken: string, metadata: { institution: { name, institution_id }, accounts: [...] } }
 *
 * Exchanges the Plaid public_token for an access_token, stores a PlaidConnection,
 * and creates Account entries for each bank/depository account.
 */

import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { requireAuth } from "~/lib/auth";
import { prisma } from "~/lib/db.server";
import {
  exchangePublicToken,
  getAccountsForItem,
  getInvestmentHoldings,
} from "~/lib/providers/plaid.server";
import { createPlaidAccount, createAccountSnapshot } from "~/lib/accounts.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireAuth(request);

  let body: {
    publicToken: string;
    metadata?: {
      institution?: { name?: string; institution_id?: string };
      accounts?: Array<{ id: string; name: string; subtype?: string; type?: string }>;
    };
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { publicToken, metadata } = body;

  if (!publicToken) {
    return json({ error: "publicToken is required" }, { status: 400 });
  }

  // 1. Exchange public token for access token
  const exchangeResult = await exchangePublicToken(publicToken);
  if (!exchangeResult.success) {
    return json({ error: exchangeResult.error }, { status: 500 });
  }

  const { accessToken: encryptedAccessToken, itemId } = exchangeResult;

  // Determine institution info
  const institutionName = metadata?.institution?.name ?? "Bank";
  const institutionId = metadata?.institution?.institution_id ?? itemId;

  // 2. Check if this item already exists
  const existingConnection = await prisma.plaidConnection.findUnique({
    where: { itemId },
  });

  if (existingConnection) {
    return json(
      { error: "This bank is already connected" },
      { status: 409 }
    );
  }

  // 3. Get accounts from Plaid
  const accountsResult = await getAccountsForItem(encryptedAccessToken);
  if (!accountsResult.success) {
    return json({ error: accountsResult.error }, { status: 500 });
  }

  // 4. Create PlaidConnection in DB
  const plaidConnection = await prisma.plaidConnection.create({
    data: {
      userId: user.id,
      institutionId,
      institutionName,
      accessToken: encryptedAccessToken,
      itemId,
      lastSynced: new Date(),
    },
  });

  // 5. Create Account entries for each Plaid account
  const createdAccounts = [];

  // Fetch investment holdings once if there are any investment accounts
  const hasInvestmentAccounts = accountsResult.accounts.some((a) => a.type === "investment");
  let investmentHoldingsResult = null;
  if (hasInvestmentAccounts) {
    investmentHoldingsResult = await getInvestmentHoldings(encryptedAccessToken);
    if (!investmentHoldingsResult.success) {
      console.warn("[plaid] Could not fetch investment holdings:", investmentHoldingsResult.error);
    }
  }

  for (const plaidAccount of accountsResult.accounts) {
    const accountType = plaidAccount.type === "investment" ? "brokerage" : "bank";
    const displayName =
      plaidAccount.officialName || plaidAccount.name || `${institutionName} Account`;

    try {
      const account = await createPlaidAccount({
        userId: user.id,
        name: displayName,
        type: accountType,
        plaidConnectionId: plaidConnection.id,
        plaidAccountId: plaidAccount.accountId,
        plaidSubtype: plaidAccount.subtype ?? undefined,
      });

      if (accountType === "bank") {
        // Create an initial bank snapshot if we have balance data
        if (
          plaidAccount.currentBalance !== null ||
          plaidAccount.availableBalance !== null
        ) {
          const currentBalance = plaidAccount.currentBalance ?? 0;
          const availableBalance = plaidAccount.availableBalance ?? currentBalance;

          await prisma.accountSnapshot.create({
            data: {
              accountId: account.id,
              totalUsdValue: currentBalance,
              currentBalance,
              availableBalance,
              currency: plaidAccount.currency,
            },
          });
        }
      } else if (accountType === "brokerage") {
        // Create initial brokerage snapshot with holdings
        if (investmentHoldingsResult && investmentHoldingsResult.success) {
          const { holdings, cashBalance, totalValue } = investmentHoldingsResult;
          const holdingsValue = totalValue - cashBalance;

          await createAccountSnapshot({
            accountId: account.id,
            totalUsdValue: totalValue,
            holdingsValue,
            cashBalance,
            holdings: holdings
              .filter((h) => h.ticker) // only include holdings with a ticker
              .map((h) => ({
                ticker: h.ticker!,
                name: h.name,
                quantity: h.quantity,
                priceUsd: h.priceUsd,
                valueUsd: h.valueUsd,
                costBasis: h.costBasis,
              })),
          });
        } else {
          // Fallback: use the balance from accountsGet
          const currentBalance = plaidAccount.currentBalance ?? 0;
          await prisma.accountSnapshot.create({
            data: {
              accountId: account.id,
              totalUsdValue: currentBalance,
              holdingsValue: currentBalance,
              cashBalance: 0,
            },
          });
        }
      }

      createdAccounts.push(account);
    } catch (err) {
      console.error("[plaid] Failed to create account:", err);
    }
  }

  return json({
    success: true,
    connectionId: plaidConnection.id,
    institutionName,
    accountsCreated: createdAccounts.length,
  });
}
