import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/lib/db.server";
import { createLoginSession } from "~/lib/auth";
import { markSetupComplete, isSetupComplete, getSetupStep } from "~/lib/settings.server";
import { redirect } from "@remix-run/node";
import { SetupSteps, getSetupStepRoute } from "~/lib/setup";

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if already complete
  const complete = await isSetupComplete();
  if (complete) {
    throw redirect("/");
  }

  // Ensure we're at the right step (must have completed settings)
  const currentStep = await getSetupStep();
  if (currentStep < SetupSteps.SETTINGS) {
    throw redirect(getSetupStepRoute(currentStep));
  }

  // Get the first (admin) user created during setup
  const adminUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!adminUser) {
    // Something went wrong, restart setup
    throw redirect("/setup/account");
  }

  // Mark setup as complete
  await markSetupComplete();

  // Log the admin user in and redirect to dashboard
  return createLoginSession(request, adminUser.id, "/");
}

export default function SetupCompletePage() {
  // This should never render as the loader always redirects
  return null;
}
