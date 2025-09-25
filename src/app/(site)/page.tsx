// src/app/(site)/page.tsx
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Category = { id: string; slug: string; name: string; parent_id: string | null };
type Project = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "paused" | "in_review" | "assigned" | "completed" | "cancelled";
  budget_kind: "fixed" | "hourly";
  budget_amount: number | null;
  hourly_min: number | null;
  hourly_max: number | null;
  city: string | null;
  country: string | null;
  created_at: string;
};
type Provider = {
  user_id: string;
  display_name: string | null;
  verified: boolean | null;
  hourly_rate: number | null;
  years_experience: number | null;
};

function Budget({ p }: { p: Project }) {
  if (p.budget_kind === "fixed") return <span>{p.budget_amount != null ? `${p.budget_amount} DZD` : "—"}</span>;
  return (
    <span>
      {p.hourly_min != null ? p.hourly_min : "—"}–{p.hourly_max != null ? p.hourly_max : "—"} DZD/h
    </span>
  );
}

function Location({ p }: { p: Project }) {
  if (!p.city && !p.country) return <span>Remote</span>;
  return <span>{[p.city, p.country].filter(Boolean).join(", ")}</span>;
}

export default async function HomePage() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  // Featured categories (top-level)
  const { data: categories } = await supabase
    .from("service_categories")
    .select("id,slug,name,parent_id")
    .is("parent_id", null)
    .order("name", { ascending: true })
    .limit(8);

  // Trending/open projects (latest open)
  const { data: projects } = await supabase
    .from("projects")
    .select("id,title,description,status,budget_kind,budget_amount,hourly_min,hourly_max,city,country,created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(6);

  // Featured providers (verified first, then latest)
  const { data: providers } = await supabase
    .from("provider_profiles")
    .select("user_id,display_name,verified,hourly_rate,years_experience")
    .order("verified", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);

  const cats = (categories as Category[] | null) ?? [];
  const projs = (projects as Project[] | null) ?? [];
  const provs = (providers as Provider[] | null) ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Hero */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">
            {user ? `Hello ${user.name}!` : "Welcome to Skilink"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Hire trusted providers across Algeria—or find your next project today.
          </p>
        </div>
        {/* Search */}
        <form action="/search" method="GET" className="mt-4 md:mt-0 flex w-full md:w-[480px]">
          <input
            name="q"
            placeholder="Search projects or providers…"
            className="flex-1 rounded-l-md border px-3 py-2"
          />
          <button type="submit" className="rounded-r-md bg-black px-4 py-2 text-white">
            Search
          </button>
        </form>
      </section>

      {/* Featured Categories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Featured Categories</h2>
          <Link href="/categories" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {cats.length ? (
            cats.map((c) => (
              <Link key={c.id} href={`/categories/${c.slug}`}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{c.name}</span>
                      <Badge variant="outline">Explore</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No categories yet.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Trending Projects */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Trending Projects</h2>
          <Link href="/projects" className="text-sm text-blue-600 hover:underline">
            Browse all
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projs.length ? (
            projs.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-2">
                  <Link href={`/projects/${p.id}`} className="text-lg font-semibold hover:underline">
                    {p.title}
                  </Link>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {p.description ?? "No description provided."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge><Budget p={p} /></Badge>
                    <Badge variant="outline"><Location p={p} /></Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No open projects yet.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Featured Providers */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Featured Providers</h2>
          <Link href="/providers" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {provs.length ? (
            provs.map((pr) => (
              <Card key={pr.user_id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/providers/${pr.user_id}`}
                      className="text-lg font-semibold hover:underline truncate"
                    >
                      {pr.display_name ?? "Unnamed provider"}
                    </Link>
                    {pr.verified ? <Badge>Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Rate:&nbsp;</span>
                      <span>{pr.hourly_rate != null ? `${pr.hourly_rate} DZD/h` : "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Experience:&nbsp;</span>
                      <span>{pr.years_experience != null ? `${pr.years_experience} yrs` : "—"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/providers/${pr.user_id}`}
                      className="rounded-md border px-3 py-2 text-sm"
                      prefetch={false}
                    >
                      View profile
                    </Link>
                    <Link
                      href={`/projects/new?invite=${pr.user_id}`}
                      className="rounded-md bg-black px-3 py-2 text-sm text-white"
                      prefetch={false}
                    >
                      Invite to project
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No providers yet.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* CTA Tiles */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Post a Project</h3>
              <p className="text-sm text-muted-foreground">Describe your task and get proposals fast.</p>
            </div>
            <Link href="/projects/new" className="rounded-md bg-black px-4 py-2 text-white">
              Get started
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Become a Provider</h3>
              <p className="text-sm text-muted-foreground">Create your profile and start receiving work.</p>
            </div>
            <Link href="/providers/onboarding" className="rounded-md border px-4 py-2">
              Create profile
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
