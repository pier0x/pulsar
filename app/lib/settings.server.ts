import { prisma } from "~/lib/db.server";

/**
 * Well-known setting keys (per-user)
 */
export const SettingKeys = {
  TIMEZONE: "timezone",
  TOKEN_THRESHOLD_USD: "token_threshold_usd",
} as const;

export type SettingKey = (typeof SettingKeys)[keyof typeof SettingKeys];

// =============================================================================
// Per-User Settings
// =============================================================================

export async function getUserSetting(userId: string, key: string): Promise<string | null> {
  const setting = await prisma.userSetting.findUnique({
    where: { userId_key: { userId, key } },
  });
  return setting?.value ?? null;
}

export async function setUserSetting(userId: string, key: string, value: string): Promise<void> {
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key } },
    update: { value },
    create: { userId, key, value },
  });
}

export async function setUserSettings(
  userId: string,
  settings: Record<string, string>
): Promise<void> {
  const operations = Object.entries(settings).map(([key, value]) =>
    prisma.userSetting.upsert({
      where: { userId_key: { userId, key } },
      update: { value },
      create: { userId, key, value },
    })
  );
  await prisma.$transaction(operations);
}

/**
 * Initialize default settings for a new user
 */
export async function initializeUserSettings(userId: string): Promise<void> {
  await setUserSettings(userId, {
    [SettingKeys.TIMEZONE]: "UTC",
    [SettingKeys.TOKEN_THRESHOLD_USD]: "0.10",
  });
}

// =============================================================================
// API Keys (from environment variables)
// =============================================================================

export async function getAlchemyApiKey(_userId: string): Promise<string | null> {
  return process.env.ALCHEMY_API_KEY || null;
}

export async function getHeliusApiKey(_userId: string): Promise<string | null> {
  return process.env.HELIUS_API_KEY || null;
}

export async function getCoinGeckoApiKey(_userId: string): Promise<string | null> {
  return process.env.COINGECKO_API_KEY || null;
}

// =============================================================================
// User Preferences
// =============================================================================

export async function getTokenThresholdUsd(userId: string): Promise<number> {
  const value = await getUserSetting(userId, SettingKeys.TOKEN_THRESHOLD_USD);
  return value ? parseFloat(value) : 0.10;
}

export async function setTokenThresholdUsd(userId: string, value: number): Promise<void> {
  await setUserSetting(userId, SettingKeys.TOKEN_THRESHOLD_USD, value.toString());
}

export async function getUserTimezone(userId: string): Promise<string> {
  const value = await getUserSetting(userId, SettingKeys.TIMEZONE);
  return value ?? "UTC";
}

export async function setUserTimezone(userId: string, timezone: string): Promise<void> {
  await setUserSetting(userId, SettingKeys.TIMEZONE, timezone);
}
