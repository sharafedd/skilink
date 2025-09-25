// src/app/(admin)/providers/page.tsx
import Link from "next/link";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// ---- Types ----

type SearchParams = {
  q?: string;                 // search by provider display_name
  verified?: "yes" | "no" | "";
  wilaya?: string;
  page?: string;
};

const PAGE_SIZE = 20;

type ProviderRow = {
  user_id: string;
  display_name: string | null;
  hourly_rate: number | null;
  min_project_value: number | null;
  years_experience: number | null;
  on_site: boolean | null;
  remote: boolean | null;
  verified: boolean | null;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string | null;
  role: string;
  is_provider: boolean;
};

type ProfileRow = {
  user_id: string;
  country: string | null;
  city: string | null;
  wilaya?: string | null;
  commune?: string | null;
};

// ---- Utils ----

function buildQueryString(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>
) {
  const merged = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...updates })) {
    if (v && v.length) merged.set(k, v);
    if (v === "") merged.delete(k);
  }
  if (updates.q !== undefined || updates.verified !== undefined || updates.wilaya !== undefined) {
    merged.set("page", "1");
  }
  const s = merged.toString();
  return s ? `?${s}` : "";
}

function VerifiedBadge(v?: boolean | null) {
  if (v) return <Badge>Verified</Badge>;
  return <Badge variant="outline">Unverified</Badge>;
}

function formatLoc(p?: ProfileRow) {
  if (!p) return "—";
  if (p.wilaya || p.commune) return [p.commune, p.wilaya].filter(Boolean).join(", ");
  if (p.city || p.country) return [p.city, p.country].filter(Boolean).join(", ");
  return "—";
}

const money = new Intl.NumberFormat("en-DZ");
const df = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" });

// ---- Page ----

export default async function AdminProvidersPage({ searchParams }: { searchParams?: SearchParams; }) {
  const supabase = await createSupabaseServerRO();

  const q = (searchParams?.q ?? "").trim();
  const verifiedParam = (searchParams?.verified as SearchParams["verified"]) || "";
  const wilaya = (searchParams?.wilaya ?? "").trim();
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Base provider query (paginate + count)
  let providerQuery = supabase
    .from("provider_profiles")
    .select(
      "user_id, display_name, hourly_rate, min_project_value, years_experience, on_site, remote, verified, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) providerQuery = providerQuery.ilike("display_name", `%${q}%`);
  if (verifiedParam === "yes") providerQuery = providerQuery.eq("verified", true);
  if (verifiedParam === "no") providerQuery = providerQuery.eq("verified", false);

  // If filtering by wilaya, limit provider user_ids by matching user_profiles
  let userIdsFilterByWilaya: string[] | null = null;
  if (wilaya) {
    const { data: profIds } = await supabase
      .from("user_profiles")
      .select("user_id")
      .or(`wilaya.ilike.%${wilaya}%,city.ilike.%${wilaya}%`);

    const rows: Array<{ user_id: string }> = (profIds as Array<{ user_id: string }>) ?? [];
    userIdsFilterByWilaya = rows.map((r) => r.user_id);

    if (userIdsFilterByWilaya.length === 0) {
      // No matches -> short-circuit with empty result UI
      return (
        <div className="space-y-6 p-4 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Providers</h1>
          <Filters q={q} verified={verifiedParam} wilaya={wilaya} currentPage={page} />
          <div className="text-xs sm:text-sm text-muted-foreground">Showing 0 of 0 providers.</div>
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">No providers found.</CardContent>
          </Card>
          <Pagination page={1} totalPages={1} baseParams={{ q: q || undefined, verified: verifiedParam || undefined, wilaya: wilaya || undefined }} />
        </div>
      );
    }
    providerQuery = providerQuery.in("user_id", userIdsFilterByWilaya);
  }

  const { data: providers, count, error } = await providerQuery;

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">Providers</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">Failed to load providers: {error.message}</div>
      </div>
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const ids = (providers ?? []).map((p: ProviderRow) => p.user_id);
  const usersMap = new Map<string, UserRow>();
  const profilesMap = new Map<string, ProfileRow>();

  if (ids.length) {
    const [{ data: users }, { data: profiles }] = await Promise.all([
      supabase.from("users").select("id,email,role,is_provider").in("id", ids),
      supabase.from("user_profiles").select("user_id,country,city,wilaya,commune").in("user_id", ids),
    ]);

    (users as UserRow[] | null)?.forEach((u) => usersMap.set(u.id, u));
    (profiles as ProfileRow[] | null)?.forEach((p) => profilesMap.set(p.user_id, p));
  }

  const baseParams: Record<string, string | undefined> = {
    q: q || undefined,
    verified: verifiedParam || undefined,
    wilaya: wilaya || undefined,
    page: String(page),
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold">Providers</h1>

      <Filters q={q} verified={verifiedParam} wilaya={wilaya} currentPage={page} />

      <div className="text-xs sm:text-sm text-muted-foreground">
        Showing <span className="font-medium">{providers?.length ?? 0}</span> of <span className="font-medium">{total}</span> providers
        {q ? <> for <span className="font-medium">&ldquo;{q}&rdquo;</span></> : null}
        {verifiedParam ? <> · {verifiedParam === "yes" ? "Verified only" : "Unverified only"}</> : null}
        {wilaya ? <> · wilaya/area: <span className="font-medium">{wilaya}</span></> : null}.
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Mobile list */}
          <div className="sm:hidden divide-y">
            {providers && providers.length > 0 ? (
              (providers as ProviderRow[]).map((p) => {
                const u = usersMap.get(p.user_id);
                const prof = profilesMap.get(p.user_id);
                return (
                  <Link key={p.user_id} href={`/admin/providers/${p.user_id}`} prefetch={false} className="block p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.display_name ?? "(no name)"}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">Email: <span className="text-blue-600">{u?.email ?? "—"}</span></span>
                          <span>Loc: {formatLoc(prof)}</span>
                          <span>Rate: {p.hourly_rate != null ? `${money.format(p.hourly_rate)} DZD/h` : "—"}</span>
                          <span>Exp: {p.years_experience ?? "—"} yrs</span>
                        </div>
                        <div className="mt-1 inline-flex items-center gap-2">{VerifiedBadge(p.verified ?? false)}</div>
                      </div>
                      <span className="shrink-0 text-xs text-blue-600">View</span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">No providers found.</div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Provider</TableHead>
                  <TableHead className="w-[20%]">Email</TableHead>
                  <TableHead className="w-[15%]">Location</TableHead>
                  <TableHead className="w-[10%]">Verified</TableHead>
                  <TableHead className="w-[10%]">Rate (DZD/h)</TableHead>
                  <TableHead className="w-[10%]">Experience</TableHead>
                  <TableHead className="w-[5%]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers && providers.length > 0 ? (
                  (providers as ProviderRow[]).map((p) => {
                    const u = usersMap.get(p.user_id);
                    const prof = profilesMap.get(p.user_id);
                    return (
                      <TableRow key={p.user_id}>
                        <TableCell className="truncate">{p.display_name ?? "(no name)"}</TableCell>
                        <TableCell className="truncate">{u?.email ?? "—"}</TableCell>
                        <TableCell className="truncate">{formatLoc(prof)}</TableCell>
                        <TableCell>{VerifiedBadge(p.verified ?? false)}</TableCell>
                        <TableCell>{p.hourly_rate != null ? money.format(p.hourly_rate) : "—"}</TableCell>
                        <TableCell>{p.years_experience ?? "—"}</TableCell>
                        <TableCell>
                          <Link href={`/admin/providers/${p.user_id}`} className="text-blue-600 hover:underline" prefetch={false} aria-label="Open provider">
                            View
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No providers found.</TableCell>
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

/* ---------- Filters component (server, plain GET) ---------- */

function Filters({ q, verified, wilaya, currentPage }: { q: string; verified: "" | "yes" | "no"; wilaya: string; currentPage: number; }) {
  const baseParams: Record<string, string | undefined> = {
    q: q || undefined,
    verified: verified || undefined,
    wilaya: wilaya || undefined,
    page: String(currentPage),
  };
  return (
    <Card>
      <CardContent className="p-4">
        <form action="/admin/providers" method="GET" className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            <label htmlFor="q" className="text-xs md:text-sm text-muted-foreground md:w-24">Search</label>
            <input id="q" name="q" defaultValue={q} placeholder="Provider name…" className="w-full rounded-md border px-3 py-2 text-sm md:text-base" />
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            <label htmlFor="verified" className="text-xs md:text-sm text-muted-foreground md:w-24">Verified</label>
            <select id="verified" name="verified" defaultValue={verified} className="w-full rounded-md border px-3 py-2 bg-white text-sm md:text-base">
              <option value="">All</option>
              <option value="yes">Only verified</option>
              <option value="no">Only unverified</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            <label htmlFor="wilaya" className="text-xs md:text-sm text-muted-foreground md:w-24">Wilaya / City</label>
            <input id="wilaya" name="wilaya" defaultValue={wilaya} placeholder="e.g., Alger, Oran…" className="w-full rounded-md border px-3 py-2 text-sm md:text-base" />
          </div>

          <div className="md:col-span-3 flex items-center gap-2 md:justify-end">
            <Link href={`/admin/providers${buildQueryString(baseParams, { q: "", verified: "", wilaya: "", page: "1" })}`} className="rounded-md border px-3 py-2 text-sm md:text-base" >
              Reset
            </Link>
            <button type="submit" className="rounded-md bg-black text-white px-3 py-2 text-sm md:text-base">Apply</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- Pagination (links, no JS) ---------- */

function Pagination({ page, totalPages, baseParams }: { page: number; totalPages: number; baseParams: Record<string, string | undefined>; }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs sm:text-sm text-muted-foreground">
        Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
      </div>
      <div className="flex gap-2">
        <Link href={page > 1 ? `/admin/providers${buildQueryString(baseParams, { page: String(page - 1) })}` : "#"} aria-disabled={page <= 1} className={`rounded-md border px-3 py-2 text-sm ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}>Previous</Link>
        <Link href={page < totalPages ? `/admin/providers${buildQueryString(baseParams, { page: String(page + 1) })}` : "#"} aria-disabled={page >= totalPages} className={`rounded-md border px-3 py-2 text-sm ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}>Next</Link>
      </div>
    </div>
  );
}
