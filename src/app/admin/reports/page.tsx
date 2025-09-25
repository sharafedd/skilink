// src/app/(admin)/reports/page.tsx
import Link from "next/link";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/* ---------- Types ---------- */

type SearchParams = {
  q?: string;                 // search in reason
  type?: "user" | "project" | "message" | "";
  from?: string;              // YYYY-MM-DD
  to?: string;                // YYYY-MM-DD
  page?: string;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: "user" | "project" | "message" | string;
  target_id: string;
  reason: string | null;
  created_at: string;
};

type UserRow = { id: string; email: string | null };

/* ---------- Utils ---------- */

const PAGE_SIZE = 20;

function buildQueryString(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>
) {
  const merged = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...updates })) {
    if (v && v.length) merged.set(k, v);
    if (v === "") merged.delete(k);
  }
  if (updates.q !== undefined || updates.type !== undefined || updates.from !== undefined || updates.to !== undefined) {
    merged.set("page", "1");
  }
  const s = merged.toString();
  return s ? `?${s}` : "";
}

function TargetBadge({ type }: { type: ReportRow["target_type"] }) {
  const variant: "outline" | undefined = type === "message" ? "outline" : undefined;
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return <Badge variant={variant}>{label}</Badge>;
}


function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/* ---------- Filters (plain GET) ---------- */

function Filters({
  q,
  type,
  from,
  to,
  currentPage,
}: {
  q: string;
  type: SearchParams["type"];
  from: string;
  to: string;
  currentPage: number;
}) {
  const baseParams: Record<string, string | undefined> = {
    q: q || undefined,
    type: type || undefined,
    from: from || undefined,
    to: to || undefined,
    page: String(currentPage),
  };
  return (
    <Card>
      <CardContent className="p-4">
        <form action="/admin/reports" method="GET" className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="flex items-center gap-2">
            <label htmlFor="q" className="text-sm text-muted-foreground w-20">Search</label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Reason…"
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="type" className="text-sm text-muted-foreground w-20">Type</label>
            <select
              id="type"
              name="type"
              defaultValue={type || ""}
              className="w-full rounded-md border px-3 py-2 bg-white"
            >
              <option value="">All</option>
              <option value="user">User</option>
              <option value="project">Project</option>
              <option value="message">Message</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="from" className="text-sm text-muted-foreground w-20">From</label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="to" className="text-sm text-muted-foreground w-20">To</label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div className="md:col-span-4 flex items-center gap-2 md:justify-end">
            <Link
              href={`/admin/reports${buildQueryString(baseParams, { q: "", type: "", from: "", to: "", page: "1" })}`}
              className="rounded-md border px-3 py-2"
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
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Page <span className="font-medium">{page}</span> of{" "}
        <span className="font-medium">{totalPages}</span>
      </div>
      <div className="flex gap-2">
        <Link
          href={
            page > 1
              ? `/admin/reports${buildQueryString(baseParams, { page: String(page - 1) })}`
              : "#"
          }
          aria-disabled={page <= 1}
          className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
        >
          Previous
        </Link>
        <Link
          href={
            page < totalPages
              ? `/admin/reports${buildQueryString(baseParams, { page: String(page + 1) })}`
              : "#"
          }
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

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createSupabaseServerRO();

  const q = (searchParams?.q ?? "").trim();
  const type = (searchParams?.type as SearchParams["type"]) || "";
  const from = (searchParams?.from ?? "").trim();
  const to = (searchParams?.to ?? "").trim();

  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  // Base query
  let repQuery = supabase
    .from("reports")
    .select("id,reporter_id,target_type,target_id,reason,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, end);

  if (q) repQuery = repQuery.ilike("reason", `%${q}%`);
  if (type) repQuery = repQuery.eq("target_type", type);
  if (from) repQuery = repQuery.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) repQuery = repQuery.lte("created_at", `${to}T23:59:59.999Z`);

  const { data: reports, count, error } = await repQuery;

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">Reports</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          Failed to load reports: {error.message}
        </div>
      </div>
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Fetch reporter emails
  const reporterIds = (reports as ReportRow[] | null)?.map((r) => r.reporter_id) ?? [];
  const reportersMap = new Map<string, UserRow>();
  if (reporterIds.length) {
    const { data: users } = await supabase.from("users").select("id,email").in("id", reporterIds);
    (users as UserRow[] | null)?.forEach((u) => reportersMap.set(u.id, u));
  }

  const baseParams: Record<string, string | undefined> = {
    q: q || undefined,
    type: type || undefined,
    from: from || undefined,
    to: to || undefined,
    page: String(page),
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Reports</h1>

      <Filters q={q} type={type} from={from} to={to} currentPage={page} />

      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{reports?.length ?? 0}</span> of{" "}
        <span className="font-medium">{total}</span> reports
        {q ? <> for <span className="font-medium">&ldquo;{q}&rdquo;</span></> : null}
        {type ? <> · type: <span className="font-medium">{type}</span></> : null}
        {from ? <> · from <span className="font-medium">{from}</span></> : null}
        {to ? <> · to <span className="font-medium">{to}</span></> : null}.
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Reporter</TableHead>
                <TableHead className="w-[12%]">Type</TableHead>
                <TableHead className="w-[28%]">Target</TableHead>
                <TableHead className="w-[25%]">Reason</TableHead>
                <TableHead className="w-[15%]">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports && reports.length > 0 ? (
                (reports as ReportRow[]).map((r) => {
                  const reporter = reportersMap.get(r.reporter_id);
                  const reporterEmail = reporter?.email ?? r.reporter_id;

                  // Build target link based on type
                  let targetHref = "#";
                  if (r.target_type === "user") targetHref = `/admin/users/${r.target_id}`;
                  else if (r.target_type === "project") targetHref = `/admin/projects/${r.target_id}`;
                  else if (r.target_type === "message") targetHref = `/admin/messages/${r.target_id}`;

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="truncate">
                        <Link href={`/admin/users/${r.reporter_id}`} className="text-blue-600 hover:underline" prefetch={false}>
                          {reporterEmail}
                        </Link>
                      </TableCell>
                      <TableCell><TargetBadge type={r.target_type as ReportRow["target_type"]} /></TableCell>
                      <TableCell className="truncate">
                        <Link href={targetHref} className="text-blue-600 hover:underline" prefetch={false}>
                          {r.target_id}
                        </Link>
                      </TableCell>
                      <TableCell className="truncate">{r.reason ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(r.created_at)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No reports found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pagination page={page} totalPages={totalPages} baseParams={baseParams} />
    </div>
  );
}
