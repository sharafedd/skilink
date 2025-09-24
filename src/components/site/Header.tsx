"use client";

import { useState } from "react";
import Container from "@/components/shared/Container";
import Logo from "@/components/shared/Logo";
import NavLink from "@/components/shared/NavLink";
import { siteMainNav, siteSecondaryNav } from "@/lib/links";

export default function SiteHeader() {
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden md:flex items-center gap-1">
            {siteMainNav.map((i) => (
              <NavLink key={i.href} href={i.href}>{i.label}</NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <form
            action="/explore"
            className="hidden sm:flex items-center rounded-lg border border-zinc-200 bg-white focus-within:ring-2 focus-within:ring-brand-300"
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

          <div className="hidden md:flex items-center gap-1">
            {siteSecondaryNav.map((i) => (
              <NavLink key={i.href} href={i.href}>{i.label}</NavLink>
            ))}
          </div>
        </div>
      </Container>
    </header>
  );
}
