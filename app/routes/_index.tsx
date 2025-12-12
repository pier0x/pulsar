import Sidebar from "~/components/layout/sidebar";
import Navbar from "~/components/layout/navbar";

export default function Example() {
  return (
    <div>
      <Sidebar />
      <div className="lg:pl-72">
        <Navbar />
        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">{/* Your content */}</div>
        </main>
      </div>
    </div>
  );
}
