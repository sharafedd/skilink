// app/(admin)/page.tsx
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// --- Types ---
type Verification = {
  id: string;
  user_id: string;
  vtype: string;
  status: string;
  created_at: string;
};

type Dispute = {
  id: string;
  contract_id: string;
  reason: string;
  created_at: string;
};

type Payout = {
  id: string;
  provider_id: string;
  amount: number;
  status: string;
  created_at: string;
};

// --- Helpers (server-safe) ---
function formatDate(d: string | Date) {
  // Use a fixed locale to avoid hydration mismatches
  try {
    return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(d));
  } catch {
    return "—";
  }
}

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerRO();

  // KPI counts
  const [usersRes, providersRes, projectsRes] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("provider_profiles").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const totalUsers = usersRes.count ?? 0;
  const totalProviders = providersRes.count ?? 0;
  const openProjects = projectsRes.count ?? 0;

  // Action queues
  const [{ data: verifications }, { data: disputes }, { data: payouts }] = await Promise.all([
    supabase
      .from("provider_verifications")
      .select("id,user_id,vtype,status,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("disputes")
      .select("id,contract_id,reason,created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("payouts")
      .select("id,provider_id,amount,status,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <header className="flex items-end justify-between gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">Admin Dashboard</h1>
        {/* room for a filter or date range later */}
      </header>

      {/* KPI Cards */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl sm:text-3xl font-bold leading-tight">{totalUsers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Providers</p>
              <p className="text-2xl sm:text-3xl font-bold leading-tight">{totalProviders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Open Projects</p>
              <p className="text-2xl sm:text-3xl font-bold leading-tight">{openProjects}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pending Verifications */}
      <section aria-labelledby="verifications-title" className="space-y-3">
        <h2 id="verifications-title" className="text-lg sm:text-xl font-semibold">Pending Verifications</h2>

        {/* Mobile (cards) */}
        <div className="sm:hidden space-y-2">
          {verifications?.length ? (
            verifications.map((v: Verification) => (
              <Card key={v.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">User: {v.user_id}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Created: {formatDate(v.created_at)}</div>
                    </div>
                    <Badge className="shrink-0">{v.vtype}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">No pending verifications 🎉</p>
          )}
        </div>

        {/* Desktop (table) */}
        <div className="hidden sm:block overflow-x-auto -mx-4 sm:mx-0">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verifications?.length ? (
                verifications.map((v: Verification) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.user_id}</TableCell>
                    <TableCell><Badge>{v.vtype}</Badge></TableCell>
                    <TableCell>{formatDate(v.created_at)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No pending verifications 🎉
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Open Disputes */}
      <section aria-labelledby="disputes-title" className="space-y-3">
        <h2 id="disputes-title" className="text-lg sm:text-xl font-semibold">Open Disputes</h2>

        {/* Mobile (cards) */}
        <div className="sm:hidden space-y-2">
          {disputes?.length ? (
            disputes.map((d: Dispute) => (
              <Card key={d.id}>
                <CardContent className="p-3">
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">Contract: {d.contract_id}</div>
                    <div className="text-xs">Reason: {d.reason}</div>
                    <div className="text-xs text-muted-foreground">Opened: {formatDate(d.created_at)}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">No open disputes</p>
          )}
        </div>

        {/* Desktop (table) */}
        <div className="hidden sm:block overflow-x-auto -mx-4 sm:mx-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputes?.length ? (
                disputes.map((d: Dispute) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.contract_id}</TableCell>
                    <TableCell>{d.reason}</TableCell>
                    <TableCell>{formatDate(d.created_at)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No open disputes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Pending Payouts */}
      <section aria-labelledby="payouts-title" className="space-y-3">
        <h2 id="payouts-title" className="text-lg sm:text-xl font-semibold">Pending Payouts</h2>

        {/* Mobile (cards) */}
        <div className="sm:hidden space-y-2">
          {payouts?.length ? (
            payouts.map((p: Payout) => (
              <Card key={p.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Provider: {p.provider_id}</div>
                      <div className="text-xs text-muted-foreground">Amount: {p.amount.toLocaleString("en-DZ")} DZD</div>
                      <div className="text-xs text-muted-foreground">Requested: {formatDate(p.created_at)}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0">{p.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">No pending payouts</p>
          )}
        </div>

        {/* Desktop (table) */}
        <div className="hidden sm:block overflow-x-auto -mx-4 sm:mx-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Amount (DZD)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts?.length ? (
                payouts.map((p: Payout) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.provider_id}</TableCell>
                    <TableCell>{p.amount.toLocaleString("en-DZ")}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No pending payouts
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
