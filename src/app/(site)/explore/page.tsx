// src/app/(site)/explore/page.tsx
import Link from "next/link";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Tab = "projects" | "providers" | "categories" | "skills";

type SearchParams = {
  t?: Tab | string;
  q?: string;          // generic search text
  cat?: string;        // category slug (projects/providers)
  wilaya?: string;     // location filter
  page?: string;
};

const PAGE_SIZE = 20;

/* ---------- helpers ---------- */

function buildQueryString(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>
) {
  const merged = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...updates })) {
    if (v && v.length) merged.set(k, v);
    if (v === "") merged.delete(k);
  }
  if ("q" in updates || "cat" in updates || "wilaya" in updates || "t" in updates) {
    merged.set("page", "1");
  }
  const s = merged.toString();
  return s ? `?${s}` : "";
}

function Tabs({
  current,
  baseParams,
}: {
  current: Tab;
  baseParams: Record<string, string | undefined>;
}) {
  const tabs: Tab[] = ["projects", "providers", "categories", "skills"];
  return (
    <div className="flex gap-2 border-b">
      {tabs.map((t) => {
        const active = current === t;
        return (
          <Link
            key={t}
            href={`/explore${buildQueryString(baseParams, { t })}`}
            className={`px-3 py-2 border-b-2 ${
              active ? "border-black font-semibold" : "border-transparent text-muted-foreground"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Link>
        );
      })}
    </div>
  );
}

function SearchFilters({
  t,
  q,
  cat,
  wilaya,
}: {
  t: Tab;
  q: string;
  cat: string;
  wilaya: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <form action="/explore" method="GET" className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input type="hidden" name="t" value={t} />
          <div className="flex items-center gap-2">
            <label htmlFor="q" className="w-20 text-sm text-muted-foreground">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder={t === "projects" ? "Project title…" : t === "providers" ? "Provider name…" : "Search…"}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          {(t === "projects" || t === "providers") && (
            <div className="flex items-center gap-2">
              <label htmlFor="cat" className="w-20 text-sm text-muted-foreground">
                Category
              </label>
              <input
                id="cat"
                name="cat"
                defaultValue={cat}
                placeholder="slug (e.g., plumbing)"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
          )}

          {(t === "projects" || t === "providers") && (
            <div className="flex items-center gap-2">
              <label htmlFor="wilaya" className="w-20 text-sm text-muted-foreground">
                Wilaya
              </label>
              <input
                id="wilaya"
                name="wilaya"
                defaultValue={wilaya}
                placeholder="e.g., Alger"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
          )}

          <div className="flex items-center gap-2 md:justify-end">
            <Link
              href={`/explore${buildQueryString({ t, q, cat, wilaya, page: "1" }, { q: "", cat: "", wilaya: "" })}`}
              className="rounded-md border px-3 py-2"
            >
              Reset
            </Link>
            <button type="submit" className="rounded-md bg-black px-3 py-2 text-white">
              Apply
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Pagination({
  page,
  totalPages,
  baseParams,
}: {
  page: number;
  totalPages: number;
  baseParams: Record<string, string | undefined>;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Page <span className="font-medium">{page}</span> of{" "}
        <span className="font-medium">{totalPages}</span>
      </div>
      <div className="flex gap-2">
        <Link
          href={
            page > 1 ? `/explore${buildQueryString(baseParams, { page: String(page - 1) })}` : "#"
          }
          className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
          aria-disabled={page <= 1}
        >
          Previous
        </Link>
        <Link
          href={
            page < totalPages ? `/explore${buildQueryString(baseParams, { page: String(page + 1) })}` : "#"
          }
          className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
          aria-disabled={page >= totalPages}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default async function ExplorePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createSupabaseServerRO();

  const t: Tab = (["projects", "providers", "categories", "skills"].includes(
    (searchParams?.t as string) || ""
  )
    ? (searchParams?.t as Tab)
    : "projects") as Tab;

  const q = (searchParams?.q ?? "").trim();
  const cat = (searchParams?.cat ?? "").trim();
  const wilaya = (searchParams?.wilaya ?? "").trim();
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const baseParams: Record<string, string | undefined> = {
    t,
    q: q || undefined,
    cat: cat || undefined,
    wilaya: wilaya || undefined,
    page: String(page),
  };

  // --- Tabs ---
  const tabs = <Tabs current={t} baseParams={baseParams} />;

  // --- PROJECTS ---
  if (t === "projects") {
    type Row = {
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

    let q1 = supabase
      .from("projects")
      .select(
        "id,title,description,status,budget_kind,budget_amount,hourly_min,hourly_max,city,country,created_at",
        { count: "exact" }
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q) q1 = q1.ilike("title", `%${q}%`);
    if (wilaya) q1 = q1.ilike("city", `%${wilaya}%`);
    if (cat) {
      // filter by category slug via join table
      const { data: catRow } = await supabase
        .from("service_categories")
        .select("id,slug")
        .eq("slug", cat)
        .limit(1)
        .single();
      const catId = (catRow as { id: string } | null)?.id;
      if (catId) {
        const { data: projIds } = await supabase
          .from("project_categories")
          .select("project_id")
          .eq("category_id", catId);
        const ids = (projIds as Array<{ project_id: string }> | null)?.map((r) => r.project_id) ?? [];
        if (ids.length) q1 = q1.in("id", ids);
        else {
          return (
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
              <h1 className="text-3xl font-bold">Explore</h1>
              {tabs}
              <SearchFilters t={t} q={q} cat={cat} wilaya={wilaya} />
              <div className="text-sm text-muted-foreground">No projects found.</div>
            </div>
          );
        }
      }
    }

    const { data, count, error } = await q1;
    if (error) {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">Explore</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            Failed to load projects: {error.message}
          </div>
        </div>
      );
    }

    const rows: Row[] = (data as Row[] | null) ?? [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Explore</h1>
        {tabs}
        <SearchFilters t={t} q={q} cat={cat} wilaya={wilaya} />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32%]">Title</TableHead>
                  <TableHead className="w-[18%]">Budget</TableHead>
                  <TableHead className="w-[20%]">Location</TableHead>
                  <TableHead className="w-[15%]">Status</TableHead>
                  <TableHead className="w-[15%]">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? (
                  rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="truncate">
                        <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline">
                          {p.title}
                        </Link>
                        <p className="text-xs text-muted-foreground line-clamp-1">{p.description ?? ""}</p>
                      </TableCell>
                      <TableCell>
                        {p.budget_kind === "fixed" ? (
                          <span>{p.budget_amount != null ? `${p.budget_amount} DZD` : "—"}</span>
                        ) : (
                          <span>
                            {p.hourly_min ?? "—"}–{p.hourly_max ?? "—"} DZD/h
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{[p.city, p.country].filter(Boolean).join(", ") || "Remote"}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "open" ? undefined : "outline"}>
                          {p.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No projects found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Pagination
          page={page}
          totalPages={totalPages}
          baseParams={{ t, q: q || undefined, cat: cat || undefined, wilaya: wilaya || undefined }}
        />
      </div>
    );
  }

  // --- PROVIDERS ---
  if (t === "providers") {
    type ProviderRow = {
      user_id: string;
      display_name: string | null;
      verified: boolean | null;
      hourly_rate: number | null;
      years_experience: number | null;
      created_at: string;
    };

    let q2 = supabase
      .from("provider_profiles")
      .select("user_id,display_name,verified,hourly_rate,years_experience,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q) q2 = q2.ilike("display_name", `%${q}%`);

    if (wilaya) {
      const { data: profIds } = await supabase
        .from("user_profiles")
        .select("user_id")
        .or(`wilaya.ilike.%${wilaya}%,city.ilike.%${wilaya}%`);
      const ids = (profIds as Array<{ user_id: string }> | null)?.map((r) => r.user_id) ?? [];
      if (ids.length) q2 = q2.in("user_id", ids);
      else {
        return (
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <h1 className="text-3xl font-bold">Explore</h1>
            {tabs}
            <SearchFilters t={t} q={q} cat={cat} wilaya={wilaya} />
            <div className="text-sm text-muted-foreground">No providers found.</div>
          </div>
        );
      }
    }

    if (cat) {
      const { data: catRow } = await supabase
        .from("service_categories")
        .select("id,slug")
        .eq("slug", cat)
        .limit(1)
        .single();
      const catId = (catRow as { id: string } | null)?.id;
      if (catId) {
        const { data: svc } = await supabase
          .from("provider_services")
          .select("user_id")
          .eq("category_id", catId);
        const ids = (svc as Array<{ user_id: string }> | null)?.map((r) => r.user_id) ?? [];
        if (ids.length) q2 = q2.in("user_id", ids);
        else {
          return (
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
              <h1 className="text-3xl font-bold">Explore</h1>
              {tabs}
              <SearchFilters t={t} q={q} cat={cat} wilaya={wilaya} />
              <div className="text-sm text-muted-foreground">No providers found.</div>
            </div>
          );
        }
      }
    }

    const { data, count, error } = await q2;
    if (error) {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">Explore</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            Failed to load providers: {error.message}
          </div>
        </div>
      );
    }

    const rows: ProviderRow[] = (data as ProviderRow[] | null) ?? [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Explore</h1>
        {tabs}
        <SearchFilters t={t} q={q} cat={cat} wilaya={wilaya} />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Provider</TableHead>
                  <TableHead className="w-[15%]">Verified</TableHead>
                  <TableHead className="w-[20%]">Rate (DZD/h)</TableHead>
                  <TableHead className="w-[15%]">Experience</TableHead>
                  <TableHead className="w-[15%]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? (
                  rows.map((pr) => (
                    <TableRow key={pr.user_id}>
                      <TableCell className="truncate">{pr.display_name ?? "Unnamed provider"}</TableCell>
                      <TableCell>{pr.verified ? <Badge>Verified</Badge> : <Badge variant="outline">Unverified</Badge>}</TableCell>
                      <TableCell>{pr.hourly_rate ?? "—"}</TableCell>
                      <TableCell>{pr.years_experience ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/providers/${pr.user_id}`} className="text-blue-600 hover:underline" prefetch={false}>
                            View
                          </Link>
                          <Link href={`/projects/new?invite=${pr.user_id}`} className="text-blue-600 hover:underline" prefetch={false}>
                            Invite
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No providers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Pagination
          page={page}
          totalPages={totalPages}
          baseParams={{ t, q: q || undefined, cat: cat || undefined, wilaya: wilaya || undefined }}
        />
      </div>
    );
  }

  // --- CATEGORIES ---
  if (t === "categories") {
    type Category = { id: string; slug: string; name: string; parent_id: string | null };

    let q3 = supabase
      .from("service_categories")
      .select("id,slug,name,parent_id", { count: "exact" })
      .order("name", { ascending: true })
      .range(from, to);

    if (q) q3 = q3.ilike("name", `%${q}%`);

    const { data, count, error } = await q3;
    if (error) {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">Explore</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            Failed to load categories: {error.message}
          </div>
        </div>
      );
    }

    const rows: Category[] = (data as Category[] | null) ?? [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Explore</h1>
        {tabs}
        <SearchFilters t={t} q={q} cat={cat} wilaya={wilaya} />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {rows.length ? (
            rows.map((c) => (
              <Link key={c.id} href={`/categories/${c.slug}`}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{c.name}</span>
                      <Badge variant="outline">{c.parent_id ? "Sub" : "Top"}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">No categories found.</CardContent>
            </Card>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} baseParams={{ t, q: q || undefined }} />
      </div>
    );
  }

  // --- SKILLS ---
  {
    type Skill = { id: string; slug: string; name: string };

    let q4 = supabase
      .from("skills")
      .select("id,slug,name", { count: "exact" })
      .order("name", { ascending: true })
      .range(from, to);

    if (q) q4 = q4.ilike("name", `%${q}%`);

    const { data, count, error } = await q4;
    if (error) {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">Explore</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            Failed to load skills: {error.message}
          </div>
        </div>
      );
    }

    const rows: Skill[] = (data as Skill[] | null) ?? [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Explore</h1>
        {tabs}
        <SearchFilters t={"skills"} q={q} cat={cat} wilaya={wilaya} />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Name</TableHead>
                  <TableHead className="w-[50%]">Slug</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? (
                  rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="truncate">{s.name}</TableCell>
                      <TableCell className="truncate">{s.slug}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                      No skills found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Pagination page={page} totalPages={totalPages} baseParams={{ t: "skills", q: q || undefined }} />
      </div>
    );
  }
}
