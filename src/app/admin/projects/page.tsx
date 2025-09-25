// src/app/(admin)/projects/page.tsx
import Link from "next/link";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/* ---------- Types ---------- */

type SearchParams = {
  q?: string;                              // search by project title
  status?: "draft" | "open" | "paused" | "in_review" | "assigned" | "completed" | "cancelled" | "";
  budget?: "fixed" | "hourly" | "";
  city?: string;
  page?: string;
};

const PAGE_SIZE = 20;

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

type UserRow = { id: string; email: string | null };

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
  if (
    updates.q !== undefined ||
    updates.status !== undefined ||
    updates.budget !== undefined ||
    updates.city !== undefined
  ) {
    merged.set("page", "1");
  }
  const s = merged.toString();
  return s ? `?${s}` : "";
}

function StatusBadge({ status }: { status: ProjectRow["status"] }) {
  const map: Record<ProjectRow["status"], "outline" | undefined> = {
    draft: "outline",
    open: undefined,
    paused: "outline",
    in_review: "outline",
    assigned: undefined,
    completed: undefined,
    cancelled: "outline",
  };
  const label = status.replace("_", " ").replace(/^[a-z]/, (c) => c.toUpperCase());
  const variant = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const money = new Intl.NumberFormat("en-DZ");
const dtf = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function BudgetCell(p: ProjectRow) {
  if (p.budget_kind === "fixed") {
    return <span>{p.budget_amount != null ? `${money.format(p.budget_amount)} DZD` : "—"}</span>;
  }
  return (
    <span>
      {p.hourly_min != null ? money.format(p.hourly_min) : "—"} – {p.hourly_max != null ? money.format(p.hourly_max) : "—"} DZD/h
    </span>
  );
}

function LocationCell(p: ProjectRow) {
  if (p.location_type === "remote") return <span>Remote</span>;
  const parts = [p.city, p.country].filter(Boolean).join(", ");
  return <span>{parts || "—"}</span>;
}

/* ---------- Filters (plain GET) ---------- */

function Filters({ q, status, budget, city, currentPage }: { q: string; status: SearchParams["status"]; budget: SearchParams["budget"]; city: string; currentPage: number; }) {
  const baseParams: Record<string, string | undefined> = {
    q: q || undefined,
    status: status || undefined,
    budget: budget || undefined,
    city: city || undefined,
    page: String(currentPage),
  };
  return (
    <Card>
      <CardContent className="p-4">
        <form action="/admin/projects" method="GET" className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            <label htmlFor="q" className="text-xs md:text-sm text-muted-foreground md:w-20">Search</label>
            <input id="q" name="q" defaultValue={q} placeholder="Project title…" className="w-full rounded-md border px-3 py-2 text-sm md:text-base" />
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            <label htmlFor="status" className="text-xs md:text-sm text-muted-foreground md:w-20">Status</label>
            <select id="status" name="status" defaultValue={status || ""} className="w-full rounded-md border px-3 py-2 bg-white text-sm md:text-base">
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="in_review">In review</option>
              <option value="paused">Paused</option>
              <option value="assigned">Assigned</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            <label htmlFor="budget" className="text-xs md:text-sm text-muted-foreground md:w-20">Budget</label>
            <select id="budget" name="budget" defaultValue={budget || ""} className="w-full rounded-md border px-3 py-2 bg-white text-sm md:text-base">
              <option value="">All</option>
              <option value="fixed">Fixed</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            <label htmlFor="city" className="text-xs md:text-sm text-muted-foreground md:w-20">City</label>
            <input id="city" name="city" defaultValue={city} placeholder="e.g., Alger, Oran…" className="w-full rounded-md border px-3 py-2 text-sm md:text-base" />
          </div>

          <div className="md:col-span-4 flex items-center gap-2 md:justify-end">
            <Link href={`/admin/projects${buildQueryString(baseParams, { q: "", status: "", budget: "", city: "", page: "1" })}`} className="rounded-md border px-3 py-2 text-sm md:text-base" >
              Reset
            </Link>
            <button type="submit" className="rounded-md bg-black text-white px-3 py-2 text-sm md:text-base">Apply</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- Pagination ---------- */

function Pagination({ page, totalPages, baseParams }: { page: number; totalPages: number; baseParams: Record<string, string | undefined>; }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs sm:text-sm text-muted-foreground">
        Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
      </div>
      <div className="flex gap-2">
        <Link href={page > 1 ? `/admin/projects${buildQueryString(baseParams, { page: String(page - 1) })}` : "#"} aria-disabled={page <= 1} className={`rounded-md border px-3 py-2 text-sm ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}>Previous</Link>
        <Link href={page < totalPages ? `/admin/projects${buildQueryString(baseParams, { page: String(page + 1) })}` : "#"} aria-disabled={page >= totalPages} className={`rounded-md border px-3 py-2 text-sm ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}>Next</Link>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default async function AdminProjectsPage({ searchParams }: { searchParams?: SearchParams; }) {
  const supabase = await createSupabaseServerRO();

  const q = (searchParams?.q ?? "").trim();
  const status = (searchParams?.status as SearchParams["status"]) || "";
  const budget = (searchParams?.budget as SearchParams["budget"]) || "";
  const city = (searchParams?.city ?? "").trim();

  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Base query + filters
  let projQuery = supabase
    .from("projects")
    .select(
      "id,buyer_id,title,description,status,budget_kind,budget_amount,hourly_min,hourly_max,location_type,country,city,created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) projQuery = projQuery.ilike("title", `%${q}%`);
  if (status) projQuery = projQuery.eq("status", status);
  if (budget) projQuery = projQuery.eq("budget_kind", budget);
  if (city) projQuery = projQuery.ilike("city", `%${city}%`);

  const { data: projects, count, error } = await projQuery;

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">Projects</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">Failed to load projects: {error.message}</div>
      </div>
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Join buyer emails (dedupe IDs)
  const buyerIds = Array.from(new Set(((projects ?? []) as ProjectRow[]).map((p) => p.buyer_id)));
  const buyersMap = new Map<string, UserRow>();
  if (buyerIds.length) {
    const { data: buyers } = await supabase.from("users").select("id,email").in("id", buyerIds);
    (buyers as UserRow[] | null)?.forEach((u) => buyersMap.set(u.id, u));
  }

  const baseParams: Record<string, string | undefined> = {
    q: q || undefined,
    status: status || undefined,
    budget: budget || undefined,
    city: city || undefined,
    page: String(page),
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold">Projects</h1>

      <Filters q={q} status={status} budget={budget} city={city} currentPage={page} />

      <div className="text-xs sm:text-sm text-muted-foreground">
        Showing <span className="font-medium">{projects?.length ?? 0}</span> of <span className="font-medium">{total}</span> projects
        {q ? <> for <span className="font-medium">&ldquo;{q}&rdquo;</span></> : null}
        {status ? <> · status: <span className="font-medium">{status}</span></> : null}
        {budget ? <> · budget: <span className="font-medium">{budget}</span></> : null}
        {city ? <> · city: <span className="font-medium">{city}</span></> : null}.
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Mobile list */}
          <div className="sm:hidden divide-y">
            {projects && projects.length > 0 ? (
              (projects as ProjectRow[]).map((p) => {
                const buyer = buyersMap.get(p.buyer_id);
                return (
                  <Link key={p.id} href={`/admin/projects/${p.id}`} prefetch={false} className="block p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">Buyer: <span className="text-blue-600">{buyer?.email ?? "—"}</span></span>
                          <span className="inline-flex items-center gap-1">Status: <StatusBadge status={p.status} /></span>
                          <span className="inline-flex items-center gap-1">Budget: <BudgetCell {...p} /></span>
                          <span>Loc: <LocationCell {...p} /></span>
                          <span>Created: {dtf.format(new Date(p.created_at))}</span>
                        </div>
                        {p.description ? (
                          <div className="mt-2 line-clamp-2 text-sm">{p.description}</div>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs text-blue-600">View</span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">No projects found.</div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28%]">Title</TableHead>
                  <TableHead className="w-[18%]">Buyer</TableHead>
                  <TableHead className="w-[14%]">Status</TableHead>
                  <TableHead className="w-[18%]">Budget</TableHead>
                  <TableHead className="w-[12%]">Location</TableHead>
                  <TableHead className="w-[10%]">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects && projects.length > 0 ? (
                  (projects as ProjectRow[]).map((p) => {
                    const buyer = buyersMap.get(p.buyer_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="truncate">
                          <Link href={`/admin/projects/${p.id}`} className="text-blue-600 hover:underline" prefetch={false}>
                            {p.title}
                          </Link>
                        </TableCell>
                        <TableCell className="truncate">{buyer?.email ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell><BudgetCell {...p} /></TableCell>
                        <TableCell><LocationCell {...p} /></TableCell>
                        <TableCell>{dtf.format(new Date(p.created_at))}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No projects found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Pagination page={page} totalPages={totalPages} baseParams={baseParams} />
    </div>
  );
}
