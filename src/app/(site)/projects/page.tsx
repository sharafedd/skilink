// src/app/(site)/projects/page.tsx
import Link from "next/link";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/* ---------- Types ---------- */

type SearchParams = {
  q?: string;                              // search by title
  budget?: "fixed" | "hourly" | "";        // budget type
  city?: string;                           // wilaya/city text
  cat?: string;                            // category slug (via project_categories)
  sort?: "newest" | "budget_high" | "hourly_high" | ""; // sorting
  page?: string;
};

type ProjectRow = {
  id: string;
  buyer_id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "paused" | "in_review" | "assigned" | "completed" | "cancelled";
  budget_kind: "fixed" | "hourly";
  budget_amount: number | null;
  hourly_min: number | null;
  hourly_max: number | null;
  location_type: string | null; // 'remote' | 'on-site' | 'hybrid'
  country: string | null;
  city: string | null;
  created_at: string;
};

type Category = { id: string; slug: string; name: string };

const PAGE_SIZE = 20;

/* ---------- Utils ---------- */

function buildQueryString(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>
) {
  const merged = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...updates })) {
    if (v && v.length) merged.set(k, v);
    if (v === "") merged.delete(k);
  }
  if ("q" in updates || "budget" in updates || "city" in updates || "cat" in updates || "sort" in updates) {
    merged.set("page", "1");
  }
  const s = merged.toString();
  return s ? `?${s}` : "";
}

function BudgetCell(p: ProjectRow) {
  if (p.budget_kind === "fixed") {
    return <span>{p.budget_amount != null ? `${p.budget_amount} DZD` : "—"}</span>;
  }
  return (
    <span>
      {p.hourly_min != null ? p.hourly_min : "—"} – {p.hourly_max != null ? p.hourly_max : "—"} DZD/h
    </span>
  );
}

function LocationCell(p: ProjectRow) {
  if (p.location_type === "remote" || (!p.city && !p.country)) return <span>Remote</span>;
  return <span>{[p.city, p.country].filter(Boolean).join(", ")}</span>;
}

/* ---------- Filters (plain GET) ---------- */

function Filters({
  q,
  budget,
  city,
  cat,
  sort,
  currentPage,
}: {
  q: string;
  budget: SearchParams["budget"];
  city: string;
  cat: string;
  sort: NonNullable<SearchParams["sort"]>;
  currentPage: number;
}) {
  const baseParams: Record<string, string | undefined> = {
    q: q || undefined,
    budget: budget || undefined,
    city: city || undefined,
    cat: cat || undefined,
    sort: sort || undefined,
    page: String(currentPage),
  };
  return (
    <Card>
      <CardContent className="p-4">
        {/* On mobile: single column, labels above inputs; on md+: compact row layout */}
        <form action="/projects" method="GET" className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {/* Search */}
          <div className="md:col-span-2">
            <label htmlFor="q" className="block text-xs sm:text-sm text-muted-foreground mb-1 md:mb-0 md:inline-block md:w-20">
              Search
            </label>
            <div className="md:inline-flex md:items-center md:gap-2 md:w-[calc(100%-5rem)] md:align-middle">
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Project title…"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label htmlFor="budget" className="block text-xs sm:text-sm text-muted-foreground mb-1 md:mb-0 md:inline-block md:w-20">
              Budget
            </label>
            <div className="md:inline-flex md:items-center md:gap-2 md:w-[calc(100%-5rem)]">
              <select
                id="budget"
                name="budget"
                defaultValue={budget || ""}
                className="w-full rounded-md border px-3 py-2 bg-white"
              >
                <option value="">All</option>
                <option value="fixed">Fixed</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
          </div>

          {/* City */}
          <div>
            <label htmlFor="city" className="block text-xs sm:text-sm text-muted-foreground mb-1 md:mb-0 md:inline-block md:w-20">
              City
            </label>
            <div className="md:inline-flex md:items-center md:gap-2 md:w-[calc(100%-5rem)]">
              <input
                id="city"
                name="city"
                defaultValue={city}
                placeholder="e.g., Alger"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="cat" className="block text-xs sm:text-sm text-muted-foreground mb-1 md:mb-0 md:inline-block md:w-20">
              Category
            </label>
            <div className="md:inline-flex md:items-center md:gap-2 md:w-[calc(100%-5rem)]">
              <input
                id="cat"
                name="cat"
                defaultValue={cat}
                placeholder="slug (e.g., plumbing)"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
          </div>

          {/* Sort */}
          <div>
            <label htmlFor="sort" className="block text-xs sm:text-sm text-muted-foreground mb-1 md:mb-0 md:inline-block md:w-20">
              Sort
            </label>
            <div className="md:inline-flex md:items-center md:gap-2 md:w-[calc(100%-5rem)]">
              <select
                id="sort"
                name="sort"
                defaultValue={sort || "newest"}
                className="w-full rounded-md border px-3 py-2 bg-white"
              >
                <option value="newest">Newest</option>
                <option value="budget_high">Highest budget</option>
                <option value="hourly_high">Highest hourly</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="md:col-span-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
            <Link
              href={`/projects${buildQueryString(baseParams, { q: "", budget: "", city: "", cat: "", sort: "newest", page: "1" })}`}
              className="rounded-md border px-3 py-2 text-center"
            >
              Reset
            </Link>
            <button type="submit" className="rounded-md bg-black text-white px-3 py-2">
              Apply
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- Pagination ---------- */

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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Page <span className="font-medium">{page}</span> of{" "}
        <span className="font-medium">{totalPages}</span>
      </div>
      <div className="flex gap-2">
        <Link
          href={page > 1 ? `/projects${buildQueryString(baseParams, { page: String(page - 1) })}` : "#"}
          aria-disabled={page <= 1}
          className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
        >
          Previous
        </Link>
        <Link
          href={page < totalPages ? `/projects${buildQueryString(baseParams, { page: String(page + 1) })}` : "#"}
          aria-disabled={page >= totalPages}
          className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createSupabaseServerRO();

  const q = (searchParams?.q ?? "").trim();
  const budget = (searchParams?.budget as SearchParams["budget"]) || "";
  const city = (searchParams?.city ?? "").trim();
  const cat = (searchParams?.cat ?? "").trim();
  const sort = (searchParams?.sort as NonNullable<SearchParams["sort"]>) || "newest";

  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Filter: category slug -> project ids
  let projectIdsByCategory: string[] | null = null;
  if (cat) {
    const { data: catRow } = await supabase
      .from("service_categories")
      .select("id,slug")
      .eq("slug", cat)
      .limit(1)
      .single();
    const catId = (catRow as { id: string } | null)?.id;
    if (catId) {
      const { data: links } = await supabase
        .from("project_categories")
        .select("project_id")
        .eq("category_id", catId);
      projectIdsByCategory = ((links as Array<{ project_id: string }> | null) ?? []).map((x) => x.project_id);
      if (!projectIdsByCategory.length) {
        // No matches for this category -> show empty state quickly
        return (
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
            <Header />
            <Filters q={q} budget={budget} city={city} cat={cat} sort={sort} currentPage={page} />
            <p className="text-sm text-muted-foreground">No projects found.</p>
          </div>
        );
      }
    } else {
      // Unknown category slug -> empty
      return (
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          <Header />
          <Filters q={q} budget={budget} city={city} cat={cat} sort={sort} currentPage={page} />
          <p className="text-sm text-muted-foreground">No projects found.</p>
        </div>
      );
    }
  }

  // Base query: show OPEN projects by default
  let query = supabase
    .from("projects")
    .select(
      "id,buyer_id,title,description,status,budget_kind,budget_amount,hourly_min,hourly_max,location_type,country,city,created_at",
      { count: "exact" }
    )
    .eq("status", "open");

  if (q) query = query.ilike("title", `%${q}%`);
  if (budget) query = query.eq("budget_kind", budget);
  if (city) query = query.ilike("city", `%${city}%`);
  if (projectIdsByCategory) query = query.in("id", projectIdsByCategory);

  // Sorting
  if (sort === "budget_high") {
    query = query.order("budget_amount", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  } else if (sort === "hourly_high") {
    query = query.order("hourly_max", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  // Pagination range must be last
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">Projects</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          Failed to load projects: {error.message}
        </div>
      </div>
    );
  }

  const rows: ProjectRow[] = (data as ProjectRow[] | null) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const baseParams: Record<string, string | undefined> = {
    q: q || undefined,
    budget: budget || undefined,
    city: city || undefined,
    cat: cat || undefined,
    sort: sort || undefined,
    page: String(page),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <Header />

      <Filters q={q} budget={budget} city={city} cat={cat} sort={sort} currentPage={page} />

      <Card>
        {/* Make the table scrollable on small screens */}
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[720px]">
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
                    <TableCell><BudgetCell {...p} /></TableCell>
                    <TableCell><LocationCell {...p} /></TableCell>
                    <TableCell>
                      <Badge variant={p.status === "open" ? undefined : "outline"}>
                        {p.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <time suppressHydrationWarning dateTime={p.created_at}>
                        {new Date(p.created_at).toLocaleString()}
                      </time>
                    </TableCell>
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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Pagination page={page} totalPages={totalPages} baseParams={baseParams} />
        <Link href="/projects/new" className="rounded-md bg-black px-4 py-2 text-white text-center">
          Post a project
        </Link>
      </div>
    </div>
  );
}

/* ---------- Header ---------- */

function Header() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl sm:text-3xl font-bold">Projects</h1>
      <Link href="/projects/new" className="rounded-md border px-3 py-2 text-sm text-center">
        Post a project
      </Link>
    </div>
  );
}
