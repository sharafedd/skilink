import "@/styles/globals.css";
import AdminLayoutClient from "./layout-client";

export const metadata = {
  title: "Skilink Admin",
  description: "Admin dashboard for Skilink.",
};

// This stays a server component (no "use client")
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
