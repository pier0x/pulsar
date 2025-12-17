import { Outlet } from "@remix-run/react";
import Sidebar from "~/components/layout/sidebar";
import Navbar from "~/components/layout/navbar";

export default function AppLayout() {
  return (
    <div className="relative h-screen p-4 flex w-full flex-row overflow-hidden">
      {/* Sidebar - fixed */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Navbar - fixed at top */}
        <div className="shrink-0 pt-10">
          <Navbar title="Home" />
        </div>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
