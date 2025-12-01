/**
 * Setup configuration (shared between client and server)
 */

/**
 * Setup steps
 */
export const SetupSteps = {
  ACCOUNT: 1,
  SETTINGS: 2,
  COMPLETE: 3,
} as const;

export const TOTAL_SETUP_STEPS = 2;

/**
 * Get the route for a specific setup step
 */
export function getSetupStepRoute(step: number): string {
  switch (step) {
    case SetupSteps.ACCOUNT:
      return "/setup/account";
    case SetupSteps.SETTINGS:
      return "/setup/settings";
    case SetupSteps.COMPLETE:
      return "/setup/complete";
    default:
      return "/setup/account";
  }
}
