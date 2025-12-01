import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { isSetupComplete, getSetupStep } from "~/lib/settings.server";
import { getSetupStepRoute } from "~/lib/setup.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const complete = await isSetupComplete();

  if (complete) {
    // Setup already done, redirect to home
    throw redirect("/");
  }

  // Redirect to current setup step
  const step = await getSetupStep();
  throw redirect(getSetupStepRoute(step));
}

export default function SetupIndexPage() {
  // This should never render as the loader always redirects
  return null;
}
