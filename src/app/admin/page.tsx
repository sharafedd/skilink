// app/(admin)/page.tsx
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerRO();

  // KPI counts
  const [{ count: totalUsers }, { count: totalProviders }, { count: openProjects }] =
    await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("provider_profiles").select("*", { count: "exact", head: true }),
      supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "open"),
    ]);

  // Action queues
  const { data: verifications } = await supabase
    .from("provider_verifications")
    .select("id,user_id,vtype,status,created_at")
    .eq("status", "pending")
    .limit(5);

  const { data: disputes } = await supabase
    .from("disputes")
    .select("id,contract_id,reason,created_at")
    .eq("status", "open")
    .limit(5);

  const { data: payouts } = await supabase
    .from("payouts")
    .select("id,provider_id,amount,status,created_at")
    .eq("status", "pending")
    .limit(5);

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-3xl font-bold">{totalUsers ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Providers</p>
            <p className="text-3xl font-bold">{totalProviders ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Open Projects</p>
            <p className="text-3xl font-bold">{openProjects ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Verifications */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Pending Verifications</h2>
        <Table>
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
                  <TableCell>{v.user_id}</TableCell>
                  <TableCell><Badge>{v.vtype}</Badge></TableCell>
                  <TableCell>{new Date(v.created_at).toLocaleDateString()}</TableCell>
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
      </section>

      {/* Open Disputes */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Open Disputes</h2>
        <Table>
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
                  <TableCell>{d.contract_id}</TableCell>
                  <TableCell>{d.reason}</TableCell>
                  <TableCell>{new Date(d.created_at).toLocaleDateString()}</TableCell>
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
      </section>

      {/* Pending Payouts */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Pending Payouts</h2>
        <Table>
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
                  <TableCell>{p.provider_id}</TableCell>
                  <TableCell>{p.amount}</TableCell>
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
      </section>
    </div>
  );
}
