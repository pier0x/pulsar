import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import Sidebar from "~/components/layout/sidebar";
import Navbar from "~/components/layout/navbar";
import MobileNav from "~/components/layout/mobile-nav";
import { requireAuth } from "~/lib/auth";
import { requireOwnerOrOnboard } from "~/lib/onboard.server";
import { getLastRefreshData } from "~/lib/lastRefresh.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOwnerOrOnboard();
  const user = await requireAuth(request);
  const lastRefresh = await getLastRefreshData(user.id);
  return json({ user, lastRefresh });
}

export default function AppLayout() {
  const { user, lastRefresh } = useLoaderData<typeof loader>();

  return (
    <div className="relative h-screen flex w-full flex-row overflow-hidden bg-nd-black">
      {/* Sidebar - fixed, hidden on mobile */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Navbar — safe-area-top for PWA standalone mode (notch/Dynamic Island) */}
        <div className="shrink-0 safe-area-top pt-4 lg:pt-8 px-4 sm:px-6 lg:px-8">
          <Navbar user={user} lastRefresh={lastRefresh} />
        </div>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto overscroll-none py-4 lg:py-8 pb-24 lg:pb-8">
          <div className="px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}
