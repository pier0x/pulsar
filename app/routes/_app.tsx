import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import Sidebar from "~/components/layout/sidebar";
import Navbar from "~/components/layout/navbar";
import MobileNav from "~/components/layout/mobile-nav";
import { requireSetupComplete } from "~/lib/setup.server";
import { requireAuth } from "~/lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  // First check if setup is complete - redirects to /setup if not
  await requireSetupComplete();
  // Then check if user is authenticated - redirects to /auth/login if not
  const user = await requireAuth(request);
  return json({ user });
}

export default function AppLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="relative h-screen p-2 sm:p-4 flex w-full flex-row overflow-hidden">
      {/* Sidebar - fixed, hidden on mobile */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Navbar - fixed at top */}
        <div className="shrink-0 pt-4 lg:pt-10">
          <Navbar user={user} />
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
