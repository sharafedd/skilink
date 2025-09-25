"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/Header";
import AdminSidebar from "@/components/admin/Sidebar";
import AdminFooter from "@/components/admin/Footer";

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col">
      <AdminHeader onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1 relative">
        <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 bg-white">{children}</main>
      </div>

      <AdminFooter />
    </div>
  );
}
