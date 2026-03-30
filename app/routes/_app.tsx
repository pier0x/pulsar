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
    <div className="relative h-screen p-2 sm:p-4 flex w-full flex-row overflow-hidden">
      {/* Sidebar - fixed, hidden on mobile */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Navbar - fixed at top */}
        <div className="shrink-0 pt-4 lg:pt-10">
          <Navbar user={user} lastRefresh={lastRefresh} />
        </div>

        {/* Scrollable content - extra padding at bottom for mobile nav */}
        <main className="flex-1 overflow-y-auto py-4 lg:py-10 pb-24 lg:pb-10">
          <div className="px-2 sm:px-4 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}
