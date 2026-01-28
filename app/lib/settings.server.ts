import { prisma } from "~/lib/db.server";
import { encrypt, decrypt, safeDecrypt } from "~/lib/crypto.server";

/**
 * Well-known setting keys (per-user)
 */
export const SettingKeys = {
  // API Keys (stored encrypted)
  ALCHEMY_API_KEY: "alchemy_api_key",
  HELIUS_API_KEY: "helius_api_key",
  COINGECKO_API_KEY: "coingecko_api_key", // Optional
  
  // User preferences
  TIMEZONE: "timezone",
  
  // Refresh configuration
  REFRESHES_PER_DAY: "refreshes_per_day",
  TOKEN_THRESHOLD_USD: "token_threshold_usd",
  LAST_SCHEDULED_REFRESH: "last_scheduled_refresh",
} as const;

export type SettingKey = (typeof SettingKeys)[keyof typeof SettingKeys];

// =============================================================================
// Per-User Settings
// =============================================================================

/**
 * Get a user setting value by key
 */
export async function getUserSetting(userId: string, key: string): Promise<string | null> {
  const setting = await prisma.userSetting.findUnique({
    where: { userId_key: { userId, key } },
  });
  return setting?.value ?? null;
}

/**
 * Get a user setting value with a default fallback
 */
export async function getUserSettingWithDefault(
  userId: string,
  key: string,
  defaultValue: string
): Promise<string> {
  const value = await getUserSetting(userId, key);
  return value ?? defaultValue;
}

/**
 * Set a user setting value (creates or updates)
 */
export async function setUserSetting(userId: string, key: string, value: string): Promise<void> {
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key } },
    update: { value },
    create: { userId, key, value },
  });
}

/**
 * Delete a user setting
 */
export async function deleteUserSetting(userId: string, key: string): Promise<void> {
  await prisma.userSetting.delete({
    where: { userId_key: { userId, key } },
  }).catch(() => {
    // Ignore if setting doesn't exist
  });
}

/**
 * Get multiple user settings at once
 */
export async function getUserSettings(userId: string, keys: string[]): Promise<Record<string, string>> {
  const settings = await prisma.userSetting.findMany({
    where: { userId, key: { in: keys } },
  });

  return settings.reduce(
    (acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    },
    {} as Record<string, string>
  );
}

/**
 * Set multiple user settings at once
 */
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
  const defaults: Record<string, string> = {
    [SettingKeys.TIMEZONE]: "UTC",
    [SettingKeys.REFRESHES_PER_DAY]: "5",
    [SettingKeys.TOKEN_THRESHOLD_USD]: "0.10",
  };

  await setUserSettings(userId, defaults);
}

// =============================================================================
// API Key Management (encrypted, per-user)
// =============================================================================

/**
 * Store an API key (encrypted)
 */
export async function setApiKey(userId: string, key: string, value: string): Promise<void> {
  const encrypted = encrypt(value);
  await setUserSetting(userId, key, encrypted);
}

/**
 * Get an API key (decrypted)
 */
export async function getApiKey(userId: string, key: string): Promise<string | null> {
  const encrypted = await getUserSetting(userId, key);
  if (!encrypted) return null;
  return safeDecrypt(encrypted);
}

/**
 * Check if an API key is configured
 */
export async function hasApiKey(userId: string, key: string): Promise<boolean> {
  const encrypted = await getUserSetting(userId, key);
  return !!encrypted;
}

/**
 * Get Alchemy API key
 */
export async function getAlchemyApiKey(userId: string): Promise<string | null> {
  return getApiKey(userId, SettingKeys.ALCHEMY_API_KEY);
}

/**
 * Set Alchemy API key
 */
export async function setAlchemyApiKey(userId: string, apiKey: string): Promise<void> {
  return setApiKey(userId, SettingKeys.ALCHEMY_API_KEY, apiKey);
}

/**
 * Get Helius API key
 */
export async function getHeliusApiKey(userId: string): Promise<string | null> {
  return getApiKey(userId, SettingKeys.HELIUS_API_KEY);
}

/**
 * Set Helius API key
 */
export async function setHeliusApiKey(userId: string, apiKey: string): Promise<void> {
  return setApiKey(userId, SettingKeys.HELIUS_API_KEY, apiKey);
}

/**
 * Get CoinGecko API key (optional, for higher rate limits)
 */
export async function getCoinGeckoApiKey(userId: string): Promise<string | null> {
  return getApiKey(userId, SettingKeys.COINGECKO_API_KEY);
}

/**
 * Set CoinGecko API key
 */
export async function setCoinGeckoApiKey(userId: string, apiKey: string): Promise<void> {
  return setApiKey(userId, SettingKeys.COINGECKO_API_KEY, apiKey);
}

// =============================================================================
// Refresh Configuration (per-user)
// =============================================================================

export type RefreshesPerDay = 1 | 3 | 5 | 10;

/**
 * Get refreshes per day setting
 */
export async function getRefreshesPerDay(userId: string): Promise<RefreshesPerDay> {
  const value = await getUserSetting(userId, SettingKeys.REFRESHES_PER_DAY);
  const parsed = value ? parseInt(value, 10) : 5;
  // Validate it's a valid option
  if ([1, 3, 5, 10].includes(parsed)) {
    return parsed as RefreshesPerDay;
  }
  return 5; // Default
}

/**
 * Set refreshes per day
 */
export async function setRefreshesPerDay(userId: string, value: RefreshesPerDay): Promise<void> {
  await setUserSetting(userId, SettingKeys.REFRESHES_PER_DAY, value.toString());
}

/**
 * Get token threshold (minimum USD value to track)
 */
export async function getTokenThresholdUsd(userId: string): Promise<number> {
  const value = await getUserSetting(userId, SettingKeys.TOKEN_THRESHOLD_USD);
  return value ? parseFloat(value) : 0.10; // Default $0.10
}

/**
 * Set token threshold
 */
export async function setTokenThresholdUsd(userId: string, value: number): Promise<void> {
  await setUserSetting(userId, SettingKeys.TOKEN_THRESHOLD_USD, value.toString());
}

/**
 * Get user timezone
 */
export async function getUserTimezone(userId: string): Promise<string> {
  const value = await getUserSetting(userId, SettingKeys.TIMEZONE);
  return value ?? "UTC";
}

/**
 * Set user timezone
 */
export async function setUserTimezone(userId: string, timezone: string): Promise<void> {
  await setUserSetting(userId, SettingKeys.TIMEZONE, timezone);
}

/**
 * Get last scheduled refresh timestamp for user
 */
export async function getLastScheduledRefresh(userId: string): Promise<Date | null> {
  const value = await getUserSetting(userId, SettingKeys.LAST_SCHEDULED_REFRESH);
  return value ? new Date(value) : null;
}

/**
 * Set last scheduled refresh timestamp for user
 */
export async function setLastScheduledRefresh(userId: string, date: Date): Promise<void> {
  await setUserSetting(userId, SettingKeys.LAST_SCHEDULED_REFRESH, date.toISOString());
}

/**
 * Check if API keys are configured for user (minimum required for balance fetching)
 */
export async function areApiKeysConfigured(userId: string): Promise<{
  alchemy: boolean;
  helius: boolean;
  complete: boolean;
}> {
  const [alchemy, helius] = await Promise.all([
    hasApiKey(userId, SettingKeys.ALCHEMY_API_KEY),
    hasApiKey(userId, SettingKeys.HELIUS_API_KEY),
  ]);
  
  return {
    alchemy,
    helius,
    complete: alchemy && helius,
  };
}
