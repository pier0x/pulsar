import Sidebar from "~/components/layout/sidebar";
import Navbar from "~/components/layout/navbar";

export default function Example() {
  return (
    <div className="relative h-screen p-4 flex w-full flex-row">
      <Sidebar />
      <div className="flex-1">
        <Navbar />
        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">{/* Your content */}</div>
        </main>
      </div>
    </div>
  );
}
