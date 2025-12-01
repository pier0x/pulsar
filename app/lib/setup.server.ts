import { redirect } from "@remix-run/node";
import { isSetupComplete, getSetupStep } from "~/lib/settings.server";
import { getSetupStepRoute } from "~/lib/setup";

// Re-export shared constants from the non-server module
export { SetupSteps, TOTAL_SETUP_STEPS, getSetupStepRoute } from "~/lib/setup";

/**
 * Require setup to be incomplete
 * Use this on setup pages to prevent access after setup is done
 */
export async function requireSetupIncomplete(): Promise<void> {
  const complete = await isSetupComplete();
  if (complete) {
    throw redirect("/");
  }
}

/**
 * Require setup to be complete
 * Use this on protected pages to redirect to setup if not done
 */
export async function requireSetupComplete(): Promise<void> {
  const complete = await isSetupComplete();
  if (!complete) {
    const step = await getSetupStep();
    throw redirect(getSetupStepRoute(step));
  }
}

/**
 * Require a specific setup step
 * Redirects to the correct step if user tries to skip ahead
 */
export async function requireSetupStep(requiredStep: number): Promise<void> {
  await requireSetupIncomplete();

  const currentStep = await getSetupStep();

  // Can't go back to completed steps
  if (requiredStep < currentStep) {
    throw redirect(getSetupStepRoute(currentStep));
  }

  // Can't skip ahead
  if (requiredStep > currentStep) {
    throw redirect(getSetupStepRoute(currentStep));
  }
}

/**
 * Check if we should redirect to setup
 * Returns the setup route if setup is needed, null otherwise
 */
export async function getSetupRedirect(): Promise<string | null> {
  const complete = await isSetupComplete();
  if (!complete) {
    const step = await getSetupStep();
    return getSetupStepRoute(step);
  }
  return null;
}
