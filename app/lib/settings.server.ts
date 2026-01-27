import { prisma } from "~/lib/db.server";
import { encrypt, decrypt, safeDecrypt } from "~/lib/crypto.server";

/**
 * Well-known setting keys
 */
export const SettingKeys = {
  // Setup
  SETUP_COMPLETED: "setup_completed",
  SETUP_STEP: "setup_step",
  APP_NAME: "app_name",
  APP_TIMEZONE: "app_timezone",
  
  // API Keys (stored encrypted)
  ALCHEMY_API_KEY: "alchemy_api_key",
  HELIUS_API_KEY: "helius_api_key",
  COINGECKO_API_KEY: "coingecko_api_key", // Optional
  
  // Refresh configuration
  REFRESHES_PER_DAY: "refreshes_per_day",
  TOKEN_THRESHOLD_USD: "token_threshold_usd",
  LAST_SCHEDULED_REFRESH: "last_scheduled_refresh",
} as const;

export type SettingKey = (typeof SettingKeys)[keyof typeof SettingKeys];

/**
 * Get a setting value by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({
    where: { key },
  });
  return setting?.value ?? null;
}

/**
 * Get a setting value with a default fallback
 */
export async function getSettingWithDefault(
  key: string,
  defaultValue: string
): Promise<string> {
  const value = await getSetting(key);
  return value ?? defaultValue;
}

/**
 * Set a setting value (creates or updates)
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/**
 * Delete a setting
 */
export async function deleteSetting(key: string): Promise<void> {
  await prisma.setting.delete({
    where: { key },
  }).catch(() => {
    // Ignore if setting doesn't exist
  });
}

/**
 * Get multiple settings at once
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: keys } },
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
 * Set multiple settings at once
 */
export async function setSettings(
  settings: Record<string, string>
): Promise<void> {
  const operations = Object.entries(settings).map(([key, value]) =>
    prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  );

  await prisma.$transaction(operations);
}

/**
 * Check if the initial setup has been completed
 */
export async function isSetupComplete(): Promise<boolean> {
  const value = await getSetting(SettingKeys.SETUP_COMPLETED);
  return value === "true";
}

/**
 * Mark the setup as complete
 */
export async function markSetupComplete(): Promise<void> {
  await setSetting(SettingKeys.SETUP_COMPLETED, "true");
}

/**
 * Get the current setup step (1, 2, etc.)
 * Returns 1 if not set
 */
export async function getSetupStep(): Promise<number> {
  const value = await getSetting(SettingKeys.SETUP_STEP);
  return value ? parseInt(value, 10) : 1;
}

/**
 * Set the current setup step
 */
export async function setSetupStep(step: number): Promise<void> {
  await setSetting(SettingKeys.SETUP_STEP, step.toString());
}

// =============================================================================
// API Key Management (encrypted)
// =============================================================================

/**
 * Store an API key (encrypted)
 */
export async function setApiKey(key: string, value: string): Promise<void> {
  const encrypted = encrypt(value);
  await setSetting(key, encrypted);
}

/**
 * Get an API key (decrypted)
 */
export async function getApiKey(key: string): Promise<string | null> {
  const encrypted = await getSetting(key);
  if (!encrypted) return null;
  return safeDecrypt(encrypted);
}

/**
 * Check if an API key is configured
 */
export async function hasApiKey(key: string): Promise<boolean> {
  const encrypted = await getSetting(key);
  return !!encrypted;
}

/**
 * Get Alchemy API key
 */
export async function getAlchemyApiKey(): Promise<string | null> {
  return getApiKey(SettingKeys.ALCHEMY_API_KEY);
}

/**
 * Set Alchemy API key
 */
export async function setAlchemyApiKey(apiKey: string): Promise<void> {
  return setApiKey(SettingKeys.ALCHEMY_API_KEY, apiKey);
}

/**
 * Get Helius API key
 */
export async function getHeliusApiKey(): Promise<string | null> {
  return getApiKey(SettingKeys.HELIUS_API_KEY);
}

/**
 * Set Helius API key
 */
export async function setHeliusApiKey(apiKey: string): Promise<void> {
  return setApiKey(SettingKeys.HELIUS_API_KEY, apiKey);
}

/**
 * Get CoinGecko API key (optional, for higher rate limits)
 */
export async function getCoinGeckoApiKey(): Promise<string | null> {
  return getApiKey(SettingKeys.COINGECKO_API_KEY);
}

/**
 * Set CoinGecko API key
 */
export async function setCoinGeckoApiKey(apiKey: string): Promise<void> {
  return setApiKey(SettingKeys.COINGECKO_API_KEY, apiKey);
}

// =============================================================================
// Refresh Configuration
// =============================================================================

export type RefreshesPerDay = 1 | 3 | 5 | 10;

/**
 * Get refreshes per day setting
 */
export async function getRefreshesPerDay(): Promise<RefreshesPerDay> {
  const value = await getSetting(SettingKeys.REFRESHES_PER_DAY);
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
export async function setRefreshesPerDay(value: RefreshesPerDay): Promise<void> {
  await setSetting(SettingKeys.REFRESHES_PER_DAY, value.toString());
}

/**
 * Get token threshold (minimum USD value to track)
 */
export async function getTokenThresholdUsd(): Promise<number> {
  const value = await getSetting(SettingKeys.TOKEN_THRESHOLD_USD);
  return value ? parseFloat(value) : 0.10; // Default $0.10
}

/**
 * Set token threshold
 */
export async function setTokenThresholdUsd(value: number): Promise<void> {
  await setSetting(SettingKeys.TOKEN_THRESHOLD_USD, value.toString());
}

/**
 * Get last scheduled refresh timestamp
 */
export async function getLastScheduledRefresh(): Promise<Date | null> {
  const value = await getSetting(SettingKeys.LAST_SCHEDULED_REFRESH);
  return value ? new Date(value) : null;
}

/**
 * Set last scheduled refresh timestamp
 */
export async function setLastScheduledRefresh(date: Date): Promise<void> {
  await setSetting(SettingKeys.LAST_SCHEDULED_REFRESH, date.toISOString());
}

/**
 * Check if API keys are configured (minimum required for balance fetching)
 */
export async function areApiKeysConfigured(): Promise<{
  alchemy: boolean;
  helius: boolean;
  complete: boolean;
}> {
  const [alchemy, helius] = await Promise.all([
    hasApiKey(SettingKeys.ALCHEMY_API_KEY),
    hasApiKey(SettingKeys.HELIUS_API_KEY),
  ]);
  
  return {
    alchemy,
    helius,
    complete: alchemy && helius,
  };
}
