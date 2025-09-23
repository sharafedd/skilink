import "@/styles/globals.css";
import AdminHeader from "@/components/admin/Header";
import AdminSidebar from "@/components/admin/Sidebar";
import AdminFooter from "@/components/admin/Footer";

export const metadata = {
  title: "Skilink Admin",
  description: "Admin dashboard for Skilink.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <AdminHeader />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 bg-white">{children}</main>
      </div>
      <AdminFooter />
    </div>
  );
}
