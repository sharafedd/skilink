import Container from "@/components/shared/Container";
import Logo from "@/components/shared/Logo";
import { Menu } from "lucide-react";

type AdminHeaderProps = {
  onMenuClick?: () => void; // optional: open sidebar/drawer on mobile
};

export default function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <Container className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        {/* Left: menu (mobile) + brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open admin menu"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50 active:scale-[0.98] transition"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo + badge */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Logo className="!h-20 sm:!h-20 md:!h-20 shrink-0" />
            <span className="rounded bg-accent-100 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-accent-700">
              Admin
            </span>
          </div>
        </div>

        {/* Right: space for actions (optional) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Put profile/avatar, notifications, etc. here */}
        </div>
      </Container>
    </header>
  );
}
