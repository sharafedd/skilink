"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Container from "@/components/shared/Container";
import Logo from "@/components/shared/Logo";
import NavLink from "@/components/shared/NavLink";
import type { SessionUser } from "@/lib/auth";
import UserAvatar from "@/components/shared/UserAvatar";
import { signOutAction } from "@/app/(site)/auth/actions";
import {
  Bell, MessageSquare, Bookmark, ChevronDown, Menu, User as UserIcon, X, Search,
  Home, Compass, Layers, Briefcase, Tag, Users, CircleHelp, History as HistoryIcon,
  LogIn, UserPlus, BadgeDollarSign
} from "lucide-react";
import { siteMainNav, siteSecondaryNav } from "@/lib/links";
import Portal from "@/components/shared/Portal";

function displayNameFrom(user: SessionUser | null): string {
  if (!user) return "Account";
  const n = (user.name ?? "").trim();
  if (n) return n;
  const e = (user.email ?? "").split("@")[0] ?? "";
  return e || "Account";
}

// Icons for primary (left) nav
const iconForMain = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes("home")) return Home;
  if (l.includes("explore") || l.includes("discover")) return Compass;
  if (l.includes("category")) return Layers;
  if (l.includes("project") || l.includes("job")) return Briefcase;
  return Tag;
};

// Icons for secondary/account actions
const iconForSecondary = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes("pricing") || l.includes("price")) return BadgeDollarSign;
  if (l.includes("saved") || l.includes("bookmark")) return Bookmark;
  if (l.includes("history")) return HistoryIcon;
  if (l.includes("help") || l.includes("support")) return CircleHelp;
  if (l.includes("provider") || l.includes("talent")) return Users;
  if (l.includes("sign in") || l.includes("login")) return LogIn;
  if (l.includes("sign up") || l.includes("register")) return UserPlus;
  return Tag;
};

export default function SiteHeader({ user }: { user: SessionUser | null }) {
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const [desktopAcctOpen, setDesktopAcctOpen] = useState(false);
  const desktopPopRef = useRef<HTMLDivElement>(null);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileAcctOpen, setMobileAcctOpen] = useState(false);

  const displayName = displayNameFrom(user);
  const avatarName = user?.name ?? (user?.email ? user.email.split("@")[0] : undefined);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (desktopPopRef.current && !desktopPopRef.current.contains(t)) {
        setDesktopAcctOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDesktopAcctOpen(false);
        setMobileNavOpen(false);
        setMobileAcctOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
      {/* ===== Mobile/Tablet bar (< lg) ===== */}
      <div className="lg:hidden">
        <div className="relative flex h-16 md:h-18 lg:h-20 items-center px-3 md:px-4">
          {/* Left burger */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => {
              setMobileNavOpen((v) => !v);
              setMobileAcctOpen(false);
            }}
            className="inline-flex items-center justify-center rounded-md p-2 md:p-2.5 hover:bg-zinc-100"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Centered logo (responsive height) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
            <Logo className="!h-20 md:!h-20 lg:!h-24 shrink-0" />
          </div>

          {/* Right cluster: md shows search icon, sign in/orders, and profile */}
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            {/* Tablet search icon (md only) */}
            <Link
              href="/explore"
              aria-label="Search"
              className="hidden md:inline-flex lg:hidden rounded-md p-2 hover:bg-zinc-100"
            >
              <Search className="h-5 w-5" />
            </Link>

            {!user ? (
              <Link
                href="/auth/sign-in"
                className="rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:underline"
              >
                Sign in
              </Link>
            ) : (
              // Orders shown in menu/profile on md (desktop shows text link)
              <Link
                href="/orders"
                className="hidden md:inline rounded-md px-2 py-1 text-sm font-medium text-zinc-800 hover:underline"
              >
                Orders
              </Link>
            )}

            <button
              type="button"
              aria-label="Account"
              onClick={() => {
                setMobileAcctOpen((v) => !v);
                setMobileNavOpen(false);
              }}
              className="inline-flex items-center justify-center rounded-full p-1.5 hover:bg-zinc-100"
            >
              {user ? (
                <UserAvatar name={avatarName} size={28} />
              ) : (
                <div className="grid h-7 w-7 place-items-center rounded-full bg-zinc-200 text-zinc-600">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ===== Desktop bar (lg+) ===== */}
      <div className="hidden lg:block">
        <Container className="flex h-20 items-center justify-between gap-4 px-6">
          {/* left: logo + main nav */}
          <div className="flex items-center gap-6">
            <Logo className="!h-26 shrink-0" />
            <nav className="hidden lg:flex items-center gap-1">
              {siteMainNav.map((i) => (
                <NavLink key={i.href} href={i.href}>
                  {i.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* right: search + auth */}
          <div className="flex items-center gap-3" ref={desktopPopRef}>
            {/* Full search (desktop only) */}
            <form
              action="/explore"
              className="hidden lg:flex items-center rounded-lg border border-zinc-200 bg-white focus-within:ring-2 focus-within:ring-brand-300"
            >
              <input
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="What are you looking for?"
                className="w-64 rounded-l-lg px-3 py-2 text-sm outline-none"
              />
              <button className="rounded-r-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">
                Search
              </button>
            </form>

            {!user && (
              <div className="hidden lg:flex items-center gap-1">
                {siteSecondaryNav.map((i) => (
                  <NavLink key={i.href} href={i.href}>
                    {i.label}
                  </NavLink>
                ))}
              </div>
            )}

            {user && (
              <div className="hidden lg:flex items-center gap-2">
                {/* icons */}
                <Link href="/saved" aria-label="Saved" className="px-2">
                  <Bookmark className="h-5 w-5" />
                </Link>
                <Link href="/messages" aria-label="Messages" className="px-2">
                  <MessageSquare className="h-5 w-5" />
                </Link>
                <Link href="/notifications" aria-label="Notifications" className="px-2">
                  <Bell className="h-5 w-5" />
                </Link>

                {/* Orders LEFT of profile (desktop only) */}
                <span className="ml-1">
                  <NavLink href="/orders">Orders</NavLink>
                </span>

                {/* Avatar dropdown on far right */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDesktopAcctOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full px-1 py-1 hover:bg-zinc-100"
                    aria-haspopup="menu"
                    aria-expanded={desktopAcctOpen}
                  >
                    <UserAvatar name={avatarName} size={32} />
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                  </button>

                  {desktopAcctOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-11 w-56 rounded-lg border border-zinc-200 bg-white shadow-2xl ring-1 ring-black/10"
                    >
                      <div className="px-3 py-2 text-sm font-medium text-zinc-900">
                        {displayName}
                      </div>
                      <div className="border-t border-zinc-200" />
                      <Link
                        href="/profile"
                        className="block px-3 py-2 text-sm hover:bg-zinc-50"
                        role="menuitem"
                      >
                        Profile
                      </Link>
                      <form action={() => start(() => signOutAction())} className="border-t border-zinc-200">
                        <button
                          type="submit"
                          className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                          disabled={pending}
                          role="menuitem"
                        >
                          {pending ? "Signing out…" : "Sign out"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Container>
      </div>

      {/* ===== Overlay + mobile panels via Portal (covers whole page) ===== */}
      <Portal>
        {(mobileNavOpen || mobileAcctOpen) && (
          <div
            className="fixed inset-0 z-[100] bg-black/45"
            onClick={() => {
              setMobileNavOpen(false);
              setMobileAcctOpen(false);
            }}
          />
        )}

        {/* Mobile/Tablet left menu: full-height side panel, responsive width */}
        <div
          className={[
            "fixed left-0 top-0 z-[110] h-dvh",
            "w-[82%] max-w-[22rem] md:w-[70%] md:max-w-[26rem] lg:w-[28rem]",
            "bg-[#2e6246] text-white shadow-2xl ring-1 ring-black/10",
            "transition-transform duration-200",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-semibold">Menu</span>
            <button
              aria-label="Close menu"
              className="rounded-md p-2 hover:bg-white/10"
              onClick={() => setMobileNavOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="px-2 py-3">
            <ul className="space-y-1">
              {siteMainNav.map((i) => {
                const Icon = iconForMain(i.label);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] hover:bg-white/10"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{i.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 h-px w-full bg-white/10" />
            <ul className="mt-3 space-y-1">
              {siteSecondaryNav.map((i) => {
                const Icon = iconForSecondary(i.label);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] hover:bg-white/10"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{i.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Mobile/Tablet account dropdown: floating box on right */}
        <div
          className={[
            "fixed right-3 top-16 z-[120] w-72 max-w-[85%]",
            "rounded-xl bg-white text-zinc-900 shadow-2xl ring-1 ring-black/10",
            "transition-transform duration-150",
            mobileAcctOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
          ].join(" ")}
          role="menu"
          aria-hidden={!mobileAcctOpen}
        >
          {user ? (
            <>
              <div className="flex items-center gap-3 px-3 py-2">
                <UserAvatar name={avatarName} size={32} />
                <div className="text-sm font-medium">{displayName}</div>
              </div>
              <div className="h-px w-full bg-zinc-200" />
              <ul className="px-1 py-2">
                <li>
                  <Link
                    href="/profile"
                    onClick={() => setMobileAcctOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    <UserIcon className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/saved"
                    onClick={() => setMobileAcctOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>Saved</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/messages"
                    onClick={() => setMobileAcctOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Messages</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/notifications"
                    onClick={() => setMobileAcctOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    <Bell className="h-4 w-4" />
                    <span>Notifications</span>
                  </Link>
                </li>
                <li className="border-t border-zinc-200 pt-2 mt-2">
                  <form
                    action={() => start(() => signOutAction())}
                    onSubmit={() => setMobileAcctOpen(false)}
                  >
                    <button
                      type="submit"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      disabled={pending}
                    >
                      {pending ? "Signing out…" : "Sign out"}
                    </button>
                  </form>
                </li>
              </ul>
            </>
          ) : (
            <div className="px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-zinc-200 text-zinc-600">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="text-sm text-zinc-700">You’re not signed in</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href="/auth/sign-in"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => setMobileAcctOpen(false)}
                >
                  <LogIn className="h-4 w-4" /> Sign in
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  onClick={() => setMobileAcctOpen(false)}
                >
                  <UserPlus className="h-4 w-4" /> Sign up
                </Link>
              </div>
            </div>
          )}
        </div>
      </Portal>
    </header>
  );
}
