// src/app/(site)/history/page.tsx
import Link from "next/link";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/* ================= Types ================= */

type Tab = "proposals" | "contracts" | "invoices";

type SearchParams = {
  t?: Tab | string;
  r?: "" | "buyer" | "provider"; // role filter (for contracts/invoices)
  page?: string;
};

type AppUser = { id: string; auth_id: string | null };

type ProposalRow = {
  id: string;
  project_id: string;
  provider_id: string;
  cover_letter: string | null;
  proposed_amount: number | null;
  proposed_hourly: number | null;
  est_days: number | null;
  status: "submitted" | "shortlisted" | "rejected" | "withdrawn" | "accepted";
  created_at: string;
};

type ProjectLite = { id: string; title: string };

type ContractRow = {
  id: string;
  project_id: string;
  buyer_id: string;
  provider_id: string;
  status: "active" | "on_hold" | "completed" | "cancelled" | "disputed";
  is_hourly: boolean;
  rate: number | null;
  fixed_amount: number | null;
  started_at: string;
  completed_at: string | null;
};

type InvoiceRow = {
  id: string;
  contract_id: string;
  amount: number;
  currency: string;
  status: "draft" | "issued" | "paid" | "void";
  issued_at: string;
  paid_at: string | null;
};

const PAGE_SIZE = 20;

/* ================= Utils ================= */

function buildQueryString(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>
) {
  const merged = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...updates })) {
    if (v && v.length) merged.set(k, v);
    if (v === "") merged.delete(k);
  }
  if ("t" in updates || "r" in updates) merged.set("page", "1");
  const s = merged.toString();
  return s ? `?${s}` : "";
}

function Pagination({
  page,
  totalPages,
  baseParams,
  hrefBase,
}: {
  page: number;
  totalPages: number;
  baseParams: Record<string, string | undefined>;
  hrefBase: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Page <span className="font-medium">{page}</span> of{" "}
        <span className="font-medium">{totalPages}</span>
      </div>
      <div className="flex gap-2">
        <Link
          href={
            page > 1 ? `${hrefBase}${buildQueryString(baseParams, { page: String(page - 1) })}` : "#"
          }
          aria-disabled={page <= 1}
          className={`rounded-md border px-4 py-2 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
        >
          Previous
        </Link>
        <Link
          href={
            page < totalPages
              ? `${hrefBase}${buildQueryString(baseParams, { page: String(page + 1) })}`
              : "#"
          }
          aria-disabled={page >= totalPages}
          className={`rounded-md border px-4 py-2 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

function Tabs({ current, baseParams }: { current: Tab; baseParams: Record<string, string | undefined> }) {
  const tabs: Tab[] = ["proposals", "contracts", "invoices"];
  return (
    <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
      <div className="flex gap-2 border-b min-w-max">
        {tabs.map((t) => {
          const active = current === t;
          return (
            <Link
              key={t}
              href={`/history${buildQueryString(baseParams, { t })}`}
              className={`px-3 py-2 border-b-2 whitespace-nowrap ${
                active ? "border-black font-semibold" : "border-transparent text-muted-foreground"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function statusBadge(text: string, outlineWhen?: string[]) {
  const variant: "outline" | undefined = outlineWhen?.includes(text) ? "outline" : undefined;
  const label = text.replace("_", " ");
  return <Badge variant={variant}>{label}</Badge>;
}

/* ================= Page ================= */

export default async function HistoryPage({ searchParams }: { searchParams?: SearchParams }) {
  const [authUser, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  if (!authUser) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold">History</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            Please <Link href="/login" className="text-blue-600 hover:underline">sign in</Link> to view your history.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Resolve current app user (by auth_id)
  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();
  const me: AppUser | null = (urow as AppUser | null) ?? null;

  if (!me) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold">History</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            We couldn’t find your account record. If this persists, contact support.
          </CardContent>
        </Card>
      </div>
    );
  }

  const t: Tab =
    (["proposals", "contracts", "invoices"].includes((searchParams?.t as string) || "")
      ? (searchParams?.t as Tab)
      : "proposals");
  const roleFilter: "" | "buyer" | "provider" = (searchParams?.r as "" | "buyer" | "provider") || "";

  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const baseParams: Record<string, string | undefined> = {
    t,
    r: roleFilter || undefined,
    page: String(page),
  };

  const header = (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl sm:text-3xl font-bold">History</h1>
      <div className="text-sm text-muted-foreground">Your recent activity</div>
    </div>
  );

  /* ---------- PROPOSALS (as provider) ---------- */
  if (t === "proposals") {
    const { data, count, error } = await supabase
      .from("proposals")
      .select(
        "id,project_id,provider_id,cover_letter,proposed_amount,proposed_hourly,est_days,status,created_at",
        { count: "exact" }
      )
      .eq("provider_id", me.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">History</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            Failed to load proposals: {error.message}
          </div>
        </div>
      );
    }

    const rows: ProposalRow[] = (data as ProposalRow[] | null) ?? [];
    const projectIds = rows.map((r) => r.project_id);
    const projMap = new Map<string, ProjectLite>();
    if (projectIds.length) {
      const { data: projs } = await supabase
        .from("projects")
        .select("id,title")
        .in("id", projectIds);
      (projs as ProjectLite[] | null)?.forEach((p) => projMap.set(p.id, p));
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {header}
        <Tabs current={t} baseParams={baseParams} />

        {/* Mobile cards */}
        <div className="grid sm:hidden gap-3">
          {rows.length ? rows.map((r) => {
            const pr = projMap.get(r.project_id);
            const price =
              r.proposed_amount != null
                ? `${r.proposed_amount} DZD (fixed)`
                : r.proposed_hourly != null
                ? `${r.proposed_hourly} DZD/h`
                : "—";
            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium line-clamp-2">
                      {pr ? (
                        <Link href={`/projects/${pr.id}`} className="hover:underline">
                          {pr.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">[deleted project]</span>
                      )}
                    </div>
                    {statusBadge(r.status, ["rejected", "withdrawn"])}
                  </div>
                  {r.cover_letter ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">{r.cover_letter}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded border px-2 py-1">{price}</span>
                    <span className="rounded border px-2 py-1">Est: {r.est_days ?? "—"} days</span>
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          }) : (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No proposals yet.</CardContent></Card>
          )}
        </div>

        {/* Desktop table */}
        <Card className="hidden sm:block">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36%]">Project</TableHead>
                  <TableHead className="w-[18%]">Proposal</TableHead>
                  <TableHead className="w-[13%]">Est. days</TableHead>
                  <TableHead className="w-[13%]">Status</TableHead>
                  <TableHead className="w-[20%]">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? (
                  rows.map((r) => {
                    const pr = projMap.get(r.project_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="truncate">
                          {pr ? (
                            <Link href={`/projects/${pr.id}`} className="text-blue-600 hover:underline">
                              {pr.title}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">[deleted project]</span>
                          )}
                          {r.cover_letter ? (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.cover_letter}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {r.proposed_amount != null ? (
                            <span>{r.proposed_amount} DZD (fixed)</span>
                          ) : r.proposed_hourly != null ? (
                            <span>{r.proposed_hourly} DZD/h</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{r.est_days ?? "—"}</TableCell>
                        <TableCell>{statusBadge(r.status, ["rejected", "withdrawn"])}</TableCell>
                        <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No proposals yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Pagination page={page} totalPages={totalPages} baseParams={baseParams} hrefBase="/history" />
      </div>
    );
  }

  /* ---------- CONTRACTS (as buyer or provider) ---------- */
  if (t === "contracts") {
    let q = supabase
      .from("contracts")
      .select("id,project_id,buyer_id,provider_id,status,is_hourly,rate,fixed_amount,started_at,completed_at", {
        count: "exact",
      })
      .order("started_at", { ascending: false });

    if (roleFilter === "buyer") q = q.eq("buyer_id", me.id);
    else if (roleFilter === "provider") q = q.eq("provider_id", me.id);
    else q = q.or(`buyer_id.eq.${me.id},provider_id.eq.${me.id}`);

    const { data, count, error } = await q.range(from, to);

    if (error) {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">History</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            Failed to load contracts: {error.message}
          </div>
        </div>
      );
    }

    const rows: ContractRow[] = (data as ContractRow[] | null) ?? [];
    const projIds = rows.map((r) => r.project_id);
    const projMap = new Map<string, ProjectLite>();
    if (projIds.length) {
      const { data: projs } = await supabase.from("projects").select("id,title").in("id", projIds);
      (projs as ProjectLite[] | null)?.forEach((p) => projMap.set(p.id, p));
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const rolePills = (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Role</span>
          <div className="inline-flex rounded-md border p-1">
            <Link
              href={`/history${buildQueryString(baseParams, { r: "" })}`}
              className={`px-3 py-1.5 text-sm rounded-md ${roleFilter === "" ? "bg-black text-white" : ""}`}
            >
              All
            </Link>
            <Link
              href={`/history${buildQueryString(baseParams, { r: "buyer" })}`}
              className={`px-3 py-1.5 text-sm rounded-md ${roleFilter === "buyer" ? "bg-black text-white" : ""}`}
            >
              Buyer
            </Link>
            <Link
              href={`/history${buildQueryString(baseParams, { r: "provider" })}`}
              className={`px-3 py-1.5 text-sm rounded-md ${roleFilter === "provider" ? "bg-black text-white" : ""}`}
            >
              Provider
            </Link>
          </div>
        </div>
      </div>
    );

    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {header}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs current={t} baseParams={baseParams} />
          {rolePills}
        </div>

        {/* Mobile cards */}
        <div className="grid sm:hidden gap-3">
          {rows.length ? rows.map((c) => {
            const pr = projMap.get(c.project_id);
            const terms = c.is_hourly ? (c.rate != null ? `${c.rate} DZD/h` : "—") : (c.fixed_amount != null ? `${c.fixed_amount} DZD` : "—");
            return (
              <Card key={c.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium line-clamp-2">
                      {pr ? (
                        <Link href={`/projects/${pr.id}`} className="hover:underline">
                          {pr.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">[deleted project]</span>
                      )}
                    </div>
                    {statusBadge(c.status, ["on_hold", "cancelled", "disputed"])}
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded border px-2 py-1">{terms}</span>
                    <span className="rounded border px-2 py-1">
                      Role: <span className="font-medium">{c.buyer_id === me.id ? "Buyer" : "Provider"}</span>
                    </span>
                    <span className="text-muted-foreground">Start: {new Date(c.started_at).toLocaleDateString()}</span>
                    <span className="text-muted-foreground">End: {c.completed_at ? new Date(c.completed_at).toLocaleDateString() : "—"}</span>
                  </div>
                </CardContent>
              </Card>
            );
          }) : (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No contracts found.</CardContent></Card>
          )}
        </div>

        {/* Desktop table */}
        <Card className="hidden sm:block">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36%]">Project</TableHead>
                  <TableHead className="w-[18%]">Terms</TableHead>
                  <TableHead className="w-[13%]">Status</TableHead>
                  <TableHead className="w-[16%]">Started</TableHead>
                  <TableHead className="w-[17%]">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? (
                  rows.map((c) => {
                    const pr = projMap.get(c.project_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="truncate">
                          {pr ? (
                            <Link href={`/projects/${pr.id}`} className="text-blue-600 hover:underline">
                              {pr.title}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">[deleted project]</span>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Role:&nbsp;
                            {c.buyer_id === me.id ? (
                              <Badge variant="outline">Buyer</Badge>
                            ) : (
                              <Badge variant="outline">Provider</Badge>
                            )}
                          </p>
                        </TableCell>
                        <TableCell>
                          {c.is_hourly ? (
                            <span>{c.rate != null ? `${c.rate} DZD/h` : "—"}</span>
                          ) : (
                            <span>{c.fixed_amount != null ? `${c.fixed_amount} DZD` : "—"}</span>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(c.status, ["on_hold", "cancelled", "disputed"])}</TableCell>
                        <TableCell>{new Date(c.started_at).toLocaleString()}</TableCell>
                        <TableCell>{c.completed_at ? new Date(c.completed_at).toLocaleString() : "—"}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No contracts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Pagination page={page} totalPages={totalPages} baseParams={baseParams} hrefBase="/history" />
      </div>
    );
  }

  /* ---------- INVOICES (linked to contracts where user is buyer or provider) ---------- */
  {
    // First find relevant contracts (ids) for this user by role filter
    let qc = supabase.from("contracts").select("id,buyer_id,provider_id");
    if (roleFilter === "buyer") qc = qc.eq("buyer_id", me.id);
    else if (roleFilter === "provider") qc = qc.eq("provider_id", me.id);
    else qc = qc.or(`buyer_id.eq.${me.id},provider_id.eq.${me.id}`);

    const { data: contractScope } = await qc;
    const contractIds = ((contractScope as Array<{ id: string }> | null) ?? []).map((x) => x.id);

    if (!contractIds.length) {
      return (
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
          {header}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs current={t} baseParams={baseParams} />
            <div className="inline-flex rounded-md border p-1">
              <Link
                href={`/history${buildQueryString(baseParams, { r: "" })}`}
                className={`px-3 py-1.5 text-sm rounded-md ${roleFilter === "" ? "bg-black text-white" : ""}`}
              >
                All
              </Link>
              <Link
                href={`/history${buildQueryString(baseParams, { r: "buyer" })}`}
                className={`px-3 py-1.5 text-sm rounded-md ${roleFilter === "buyer" ? "bg-black text-white" : ""}`}
              >
                Buyer
              </Link>
              <Link
                href={`/history${buildQueryString(baseParams, { r: "provider" })}`}
                className={`px-3 py-1.5 text-sm rounded-md ${roleFilter === "provider" ? "bg-black text-white" : ""}`}
              >
                Provider
              </Link>
            </div>
          </div>
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">No invoices found.</CardContent>
          </Card>
        </div>
      );
    }

    // Fetch invoices within these contracts
    const { data, count, error } = await supabase
      .from("invoices")
      .select("id,contract_id,amount,currency,status,issued_at,paid_at", { count: "exact" })
      .in("contract_id", contractIds)
      .order("issued_at", { ascending: false })
      .range(from, to);

    if (error) {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">History</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            Failed to load invoices: {error.message}
          </div>
        </div>
      );
    }

    const rows: InvoiceRow[] = (data as InvoiceRow[] | null) ?? [];
    const cids = rows.map((r) => r.contract_id);

    // Load contract -> project title for context
    const contractMap = new Map<
      string,
      { id: string; project_id: string; role: "buyer" | "provider" }
    >();
    if (cids.length) {
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id,project_id,buyer_id,provider_id")
        .in("id", cids);
      ((contracts as Array<{ id: string; project_id: string; buyer_id: string; provider_id: string }> | null) ?? []).forEach(
        (c) => {
          const role: "buyer" | "provider" = c.buyer_id === me.id ? "buyer" : "provider";
          contractMap.set(c.id, { id: c.id, project_id: c.project_id, role });
        }
      );
    }

    const projIds = Array.from(new Set(Array.from(contractMap.values()).map((x) => x.project_id)));
    const projMap = new Map<string, ProjectLite>();
    if (projIds.length) {
      const { data: projs } = await supabase.from("projects").select("id,title").in("id", projIds);
      (projs as ProjectLite[] | null)?.forEach((p) => projMap.set(p.id, p));
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {header}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs current={t} baseParams={baseParams} />
          <div className="inline-flex rounded-md border p-1">
            <Link
              href={`/history${buildQueryString(baseParams, { r: "" })}`}
              className={`px-3 py-1.5 text-sm rounded-md ${roleFilter === "" ? "bg-black text-white" : ""}`}
            >
              All
            </Link>
            <Link
              href={`/history${buildQueryString(baseParams, { r: "buyer" })}`}
              className={`px-3 py-1.5 text-sm rounded-md ${roleFilter === "buyer" ? "bg-black text-white" : ""}`}
            >
              Buyer
            </Link>
            <Link
              href={`/history${buildQueryString(baseParams, { r: "provider" })}`}
              className={`px-3 py-1.5 text-sm rounded-md ${roleFilter === "provider" ? "bg-black text-white" : ""}`}
            >
              Provider
            </Link>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="grid sm:hidden gap-3">
          {rows.length ? rows.map((inv) => {
            const c = contractMap.get(inv.contract_id);
            const pr = c ? projMap.get(c.project_id) : undefined;
            return (
              <Card key={inv.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium line-clamp-2">
                      {pr ? (
                        <Link href={`/projects/${pr.id}`} className="hover:underline">
                          {pr.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">[unknown project]</span>
                      )}
                    </div>
                    {statusBadge(inv.status, ["draft", "void"])}
                  </div>
                  {c ? (
                    <div className="text-xs text-muted-foreground">
                      Role: <Badge variant="outline">{c.role}</Badge>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded border px-2 py-1">
                      {inv.amount.toLocaleString()} {inv.currency}
                    </span>
                    <span className="text-muted-foreground">Issued: {new Date(inv.issued_at).toLocaleDateString()}</span>
                    <span className="text-muted-foreground">Paid: {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}</span>
                  </div>
                </CardContent>
              </Card>
            );
          }) : (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No invoices found.</CardContent></Card>
          )}
        </div>

        {/* Desktop table */}
        <Card className="hidden sm:block">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%]">Project</TableHead>
                  <TableHead className="w-[18%]">Amount</TableHead>
                  <TableHead className="w-[14%]">Status</TableHead>
                  <TableHead className="w-[17%]">Issued</TableHead>
                  <TableHead className="w-[17%]">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? (
                  rows.map((inv) => {
                    const c = contractMap.get(inv.contract_id);
                    const pr = c ? projMap.get(c.project_id) : undefined;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="truncate">
                          {pr ? (
                            <Link href={`/projects/${pr.id}`} className="text-blue-600 hover:underline">
                              {pr.title}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">[unknown project]</span>
                          )}
                          {c ? (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Role: <Badge variant="outline">{c.role}</Badge>
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>{inv.amount.toLocaleString()} {inv.currency}</TableCell>
                        <TableCell>{statusBadge(inv.status, ["draft", "void"])}</TableCell>
                        <TableCell>{new Date(inv.issued_at).toLocaleString()}</TableCell>
                        <TableCell>{inv.paid_at ? new Date(inv.paid_at).toLocaleString() : "—"}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No invoices found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Pagination page={page} totalPages={totalPages} baseParams={baseParams} hrefBase="/history" />
      </div>
    );
  }
}
