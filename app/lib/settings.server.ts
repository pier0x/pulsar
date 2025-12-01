import { prisma } from "~/lib/db.server";

/**
 * Well-known setting keys
 */
export const SettingKeys = {
  SETUP_COMPLETED: "setup_completed",
  SETUP_STEP: "setup_step",
  APP_NAME: "app_name",
  APP_TIMEZONE: "app_timezone",
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
