"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNav } from "@/lib/links";
import { cn } from "@/lib/utils";

export default function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-brand-50/60 p-4 lg:block">
      <nav className="space-y-1">
        {adminNav.map((i) => {
          const active = pathname === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm",
                active ? "bg-brand-100 text-brand-900" : "hover:bg-brand-100 text-zinc-700"
              )}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
