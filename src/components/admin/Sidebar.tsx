"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNav } from "@/lib/links";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export default function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity md:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          // Full height, fixed on mobile
          "fixed top-0 left-0 z-50 h-screen w-64 p-4 border-r transition-transform md:static md:h-auto md:translate-x-0 md:block",
          // Your image color as background
          "bg-[#F5F7F4]", // 👈 this hex is extracted from your uploaded image
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ overflow: "hidden" }} // disable internal scrolling
      >
        <nav className="space-y-1">
          {adminNav.map((i) => {
            const active = pathname === i.href;
            return (
              <Link
                key={i.href}
                href={i.href}
                onClick={onClose}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm",
                  active
                    ? "bg-brand-100 text-brand-900"
                    : "hover:bg-brand-100 text-zinc-700"
                )}
              >
                {i.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
