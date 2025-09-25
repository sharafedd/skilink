// src/app/(site)/orders/page.tsx
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/* ============== Types ============== */
type Tab = "invoices" | "payouts";
type RoleFilter = "" | "buyer" | "provider";
type SearchParams = { t?: string; r?: string; page?: string };

type AppUser = { id: string; auth_id: string | null; email: string | null };

type ContractLite = { id: string; project_id: string; buyer_id: string; provider_id: string };
type ProjectLite = { id: string; title: string };
type InvoiceRow = {
  id: string;
  contract_id: string;
  amount: number;
  currency: string;
  status: "draft" | "issued" | "paid" | "void";
  issued_at: string;
  paid_at: string | null;
};
type PayoutRow = {
  id: string;
  provider_id: string;
  amount: number;
  currency: string;
  status: string; // 'pending' | 'paid' | etc.
  created_at: string;
  processed_at: string | null;
};

const PAGE_SIZE = 20;

/* ============== Helpers ============== */
function qs(base: Record<string, string | undefined>, up: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  const merged = { ...base, ...up };
  for (const [k, v] of Object.entries(merged)) {
    if (v && v.length) sp.set(k, v);
    if (v === "") sp.delete(k);
  }
  // If tab or role changes, reset to page 1
  if ("t" in up || "r" in up) sp.set("page", "1");
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function StatusBadge({ s }: { s: string }) {
  const outline = ["draft", "void", "pending"].includes(s);
  return <Badge variant={outline ? "outline" : undefined}>{s.replace("_", " ")}</Badge>;
}

async function resolveOrCreateAppUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerRO>>,
  authId: string,
  email: string | null
): Promise<AppUser | null> {
  const { data: byAuth } = await supabase
    .from("users")
    .select("id,auth_id,email")
    .eq("auth_id", authId)
    .limit(1)
    .maybeSingle();
  if (byAuth) return byAuth as AppUser;

  if (email) {
    const { data: byEmail } = await supabase
      .from("users")
      .select("id,auth_id,email")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    const row = byEmail as AppUser | null;
    if (row) {
      await supabase.from("users").update({ auth_id: authId, updated_at: new Date().toISOString() }).eq("id", row.id);
      return { id: row.id, auth_id: authId, email: row.email };
    }
  }

  if (!email) return null;

  const { data: created } = await supabase
    .from("users")
    .insert({ email, auth_id: authId, role: "buyer", is_provider: false })
    .select("id,auth_id,email")
    .single();

  return (created as AppUser | null) ?? null;
}

/* ============== Server actions ============== */
async function markInvoicePaid(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return;

  const invoice_id = String(formData.get("invoice_id") || "");
  if (!invoice_id) return;

  // Load invoice + contract to validate role
  const { data: inv } = await supabase
    .from("invoices")
    .select("id,contract_id,status,amount,currency")
    .eq("id", invoice_id)
    .maybeSingle();

  const invoice = inv as (InvoiceRow & { contract_id: string }) | null;
  if (!invoice || invoice.status !== "issued") return;

  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return;

  const { data: ctr } = await supabase
    .from("contracts")
    .select("id,buyer_id")
    .eq("id", invoice.contract_id)
    .maybeSingle();

  const contract = ctr as { id: string; buyer_id: string } | null;
  if (!contract || contract.buyer_id !== me.id) return;

  // Mark paid + add a transaction
  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoice_id);

  await supabase.from("transactions").insert({
    invoice_id,
    contract_id: invoice.contract_id,
    ttype: "charge",
    amount: invoice.amount,
    currency: invoice.currency,
  });

  revalidatePath("/orders");
}

/* ============== Page ============== */
export default async function OrdersPage({ searchParams }: { searchParams?: SearchParams }) {
  const [auth, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  if (!auth) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <h1 className="text-2xl sm:text-3xl font-bold">Orders</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            Please <Link href="/login" className="text-blue-600 hover:underline">sign in</Link> to view your orders.
          </CardContent>
        </Card>
      </div>
    );
  }

  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <h1 className="text-2xl sm:text-3xl font-bold">Orders</h1>
        <Card><CardContent className="p-6 text-sm">We couldn’t find your account record.</CardContent></Card>
      </div>
    );
  }

  const t: Tab = (["invoices", "payouts"].includes(searchParams?.t ?? "") ? (searchParams!.t as Tab) : "invoices");
  const r: RoleFilter =
    (t === "invoices" ? (["", "buyer", "provider"].includes(searchParams?.r ?? "") ? (searchParams!.r as RoleFilter) : "") : "");

  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const baseParams: Record<string, string | undefined> = { t, r: r || undefined, page: String(page) };

  /* ---------- INVOICES ---------- */
  if (t === "invoices") {
    // Build contract scope by role
    let qc = supabase.from("contracts").select("id,project_id,buyer_id,provider_id");
    if (r === "buyer") qc = qc.eq("buyer_id", me.id);
    else if (r === "provider") qc = qc.eq("provider_id", me.id);
    else qc = qc.or(`buyer_id.eq.${me.id},provider_id.eq.${me.id}`);

    const { data: contracts } = await qc;
    const contractList = (contracts as ContractLite[] | null) ?? [];
    const contractIds = contractList.map((c) => c.id);

    // Map contract → project + role
    const roleByContract = new Map<string, "buyer" | "provider">();
    const projectByContract = new Map<string, string>();
    contractList.forEach((c) => {
      roleByContract.set(c.id, c.buyer_id === me.id ? "buyer" : "provider");
      projectByContract.set(c.id, c.project_id);
    });

    let invoices: InvoiceRow[] = [];
    let total = 0;

    if (contractIds.length) {
      const { data, count } = await supabase
        .from("invoices")
        .select("id,contract_id,amount,currency,status,issued_at,paid_at", { count: "exact" })
        .in("contract_id", contractIds)
        .order("issued_at", { ascending: false })
        .range(from, to);
      invoices = (data as InvoiceRow[] | null) ?? [];
      total = count ?? 0;
    }

    // Load project titles
    const projectIds = Array.from(new Set(invoices.map((i) => projectByContract.get(i.contract_id)).filter(Boolean))) as string[];
    const projMap = new Map<string, ProjectLite>();
    if (projectIds.length) {
      const { data: projs } = await supabase.from("projects").select("id,title").in("id", projectIds);
      (projs as ProjectLite[] | null)?.forEach((p) => projMap.set(p.id, p));
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {/* Header + tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Orders</h1>
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
            <div className="inline-flex rounded-md border p-1 min-w-max">
              {(["invoices", "payouts"] as Tab[]).map((tab) => (
                <Link
                  key={tab}
                  href={`/orders${qs(baseParams, { t: tab, r: tab === "invoices" ? r : undefined, page: "1" })}`}
                  className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${t === tab ? "bg-black text-white" : ""}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Role filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">Your invoices as buyer or provider</div>
          <div className="inline-flex rounded-md border p-1">
            {[
              { label: "All", val: "" },
              { label: "Buyer", val: "buyer" },
              { label: "Provider", val: "provider" },
            ].map((opt) => (
              <Link
                key={opt.val || "all"}
                href={`/orders${qs(baseParams, { r: opt.val, page: "1" })}`}
                className={`px-3 py-1.5 text-sm rounded-md ${r === (opt.val as RoleFilter) ? "bg-black text-white" : ""}`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="grid sm:hidden gap-3">
          {invoices.length ? invoices.map((inv) => {
            const role = roleByContract.get(inv.contract_id) ?? "buyer";
            const projId = projectByContract.get(inv.contract_id);
            const proj = projId ? projMap.get(projId) : undefined;

            return (
              <Card key={inv.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium line-clamp-2">
                      {proj ? (
                        <Link href={`/projects/${proj.id}`} className="hover:underline">
                          {proj.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">[unknown project]</span>
                      )}
                    </div>
                    <StatusBadge s={inv.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Role: <Badge variant="outline">{role}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded border px-2 py-1">
                      {inv.amount.toLocaleString()} {inv.currency}
                    </span>
                    <span className="text-muted-foreground">
                      Issued: {new Date(inv.issued_at).toLocaleDateString()}
                    </span>
                    <span className="text-muted-foreground">
                      Paid: {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  {/* Quick action for buyers on issued invoices */}
                  {role === "buyer" && inv.status === "issued" ? (
                    <form action={markInvoicePaid} className="pt-1">
                      <input type="hidden" name="invoice_id" value={inv.id} />
                      <button className="w-full rounded-md border px-3 py-2 text-sm">Mark paid</button>
                    </form>
                  ) : null}
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
                  <TableHead className="w-[36%]">Project</TableHead>
                  <TableHead className="w-[16%]">Amount</TableHead>
                  <TableHead className="w-[14%]">Status</TableHead>
                  <TableHead className="w-[17%]">Issued</TableHead>
                  <TableHead className="w-[17%]">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length ? (
                  invoices.map((inv) => {
                    const role = roleByContract.get(inv.contract_id) ?? "buyer";
                    const projId = projectByContract.get(inv.contract_id);
                    const proj = projId ? projMap.get(projId) : undefined;

                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="truncate">
                          {proj ? (
                            <Link href={`/projects/${proj.id}`} className="text-blue-600 hover:underline">
                              {proj.title}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">[unknown project]</span>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Role: <Badge variant="outline">{role}</Badge>
                          </p>
                        </TableCell>
                        <TableCell>{inv.amount.toLocaleString()} {inv.currency}</TableCell>
                        <TableCell><StatusBadge s={inv.status} /></TableCell>
                        <TableCell>
                          <time suppressHydrationWarning dateTime={inv.issued_at}>
                            {new Date(inv.issued_at).toLocaleString()}
                          </time>
                        </TableCell>
                        <TableCell>
                          {inv.paid_at ? (
                            <time suppressHydrationWarning dateTime={inv.paid_at}>
                              {new Date(inv.paid_at).toLocaleString()}
                            </time>
                          ) : role === "buyer" && inv.status === "issued" ? (
                            <form action={markInvoicePaid}>
                              <input type="hidden" name="invoice_id" value={inv.id} />
                              <button className="rounded-md border px-3 py-1.5 text-sm">Mark paid</button>
                            </form>
                          ) : (
                            "—"
                          )}
                        </TableCell>
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

        {/* Pagination */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Page <span className="font-medium">{page}</span> of{" "}
            <span className="font-medium">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <Link
              href={page > 1 ? `/orders${qs(baseParams, { page: String(page - 1) })}` : "#"}
              aria-disabled={page <= 1}
              className={`rounded-md border px-4 py-2 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              Previous
            </Link>
            <Link
              href={page < totalPages ? `/orders${qs(baseParams, { page: String(page + 1) })}` : "#"}
              aria-disabled={page >= totalPages}
              className={`rounded-md border px-4 py-2 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            >
              Next
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- PAYOUTS (provider only) ---------- */
  {
    const { data, count } = await supabase
      .from("payouts")
      .select("id,provider_id,amount,currency,status,created_at,processed_at", { count: "exact" })
      .eq("provider_id", me.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    const payouts: PayoutRow[] = (data as PayoutRow[] | null) ?? [];
    const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Orders</h1>
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
            <div className="inline-flex rounded-md border p-1 min-w-max">
              <Link href={`/orders${qs(baseParams, { t: "invoices", page: "1" })}`} className="px-3 py-1.5 text-sm rounded-md">
                Invoices
              </Link>
              <Link href={`/orders${qs(baseParams, { t: "payouts", page: "1" })}`} className="px-3 py-1.5 text-sm rounded-md bg-black text-white">
                Payouts
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="grid sm:hidden gap-3">
          {payouts.length ? payouts.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{p.amount.toLocaleString()} {p.currency}</div>
                  <StatusBadge s={p.status} />
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Created: {new Date(p.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-muted-foreground">
                    Processed: {p.processed_at ? new Date(p.processed_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )) : (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No payouts yet.</CardContent></Card>
          )}
        </div>

        {/* Desktop table */}
        <Card className="hidden sm:block">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Amount</TableHead>
                  <TableHead className="w-[20%]">Status</TableHead>
                  <TableHead className="w-[30%]">Created</TableHead>
                  <TableHead className="w-[30%]">Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length ? (
                  payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.amount.toLocaleString()} {p.currency}</TableCell>
                      <TableCell><StatusBadge s={p.status} /></TableCell>
                      <TableCell>
                        <time suppressHydrationWarning dateTime={p.created_at}>
                          {new Date(p.created_at).toLocaleString()}
                        </time>
                      </TableCell>
                      <TableCell>
                        {p.processed_at ? (
                          <time suppressHydrationWarning dateTime={p.processed_at}>
                            {new Date(p.processed_at).toLocaleString()}
                          </time>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      No payouts yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Page <span className="font-medium">{page}</span> of{" "}
            <span className="font-medium">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <Link
              href={page > 1 ? `/orders${qs(baseParams, { page: String(page - 1) })}` : "#"}
              aria-disabled={page <= 1}
              className={`rounded-md border px-4 py-2 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              Previous
            </Link>
            <Link
              href={page < totalPages ? `/orders${qs(baseParams, { page: String(page + 1) })}` : "#"}
              aria-disabled={page >= totalPages}
              className={`rounded-md border px-4 py-2 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            >
              Next
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
