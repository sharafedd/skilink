// src/app/(site)/help/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SearchParams = { submitted?: string };

type AppUser = { id: string; auth_id: string | null };
type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  created_at: string;
};

async function createTicket(formData: FormData) {
  "use server";
  const [supabase, authUser] = await Promise.all([createSupabaseServerRO(), getCurrentUser()]);
  if (!authUser) return redirect("/login");

  // Map auth user -> app user id
  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();
  const me: AppUser | null = (urow as AppUser | null) ?? null;
  if (!me) return redirect("/help");

  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const type = String(formData.get("type") || "support").trim(); // 'support' | 'project' | 'user' | 'message'
  const targetIdRaw = String(formData.get("targetId") || "").trim();

  // Target: if not provided, bind to the user
  const target_id = targetIdRaw && targetIdRaw.length ? targetIdRaw : me.id;
  const target_type = type || "support";
  const reason = subject ? `${subject}\n\n${message}` : message;

  await supabase.from("reports").insert({
    reporter_id: me.id,
    target_type,
    target_id,
    reason,
  });

  revalidatePath("/help");
  redirect("/help?submitted=1");
}

export default async function HelpPage({ searchParams }: { searchParams?: SearchParams }) {
  const [authUser, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  // Resolve app user id (optional – page also works for signed-out users)
  let me: AppUser | null = null;
  if (authUser) {
    const { data: urow } = await supabase
      .from("users")
      .select("id,auth_id")
      .eq("auth_id", authUser.id)
      .limit(1)
      .maybeSingle();
    me = (urow as AppUser | null) ?? null;
  }

  // Recent tickets (only if signed in)
  let recent: ReportRow[] = [];
  if (me) {
    const { data } = await supabase
      .from("reports")
      .select("id,reporter_id,target_type,target_id,reason,created_at")
      .eq("reporter_id", me.id)
      .order("created_at", { ascending: false })
      .limit(10);
    recent = (data as ReportRow[] | null) ?? [];
  }

  const submitted = searchParams?.submitted === "1";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Help Center</h1>
          <p className="text-sm text-muted-foreground">
            Find answers or send us a request. We typically respond within 24–48h.
          </p>
        </div>
        <Link href="/providers" className="rounded-md border px-3 py-2 text-sm">Browse providers</Link>
      </div>

      {/* Success note */}
      {submitted ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm">
          Thanks! Your request was submitted.
        </div>
      ) : null}

      {/* Two-column: FAQs + Contact */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* FAQs */}
        <div className="md:col-span-2 space-y-3">
          <Card>
            <CardContent className="p-4 space-y-2">
              <h2 className="text-lg font-semibold">FAQs</h2>

              <details className="rounded-md border px-4 py-3">
                <summary className="cursor-pointer font-medium">How do payments work?</summary>
                <p className="mt-2 text-sm text-muted-foreground">
                  Projects can be fixed-price or hourly. Funds are held in escrow and released on milestone completion.
                </p>
              </details>

              <details className="rounded-md border px-4 py-3">
                <summary className="cursor-pointer font-medium">How do I become a provider?</summary>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a provider profile, add services and skills, then start sending proposals.
                  <Link href="/providers/onboarding" className="ml-1 text-blue-600 hover:underline">Start here</Link>.
                </p>
              </details>

              <details className="rounded-md border px-4 py-3">
                <summary className="cursor-pointer font-medium">How do I report an issue?</summary>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use the form on this page. For a project-specific issue, set type to “project” and include the project ID.
                </p>
              </details>
            </CardContent>
          </Card>

          {/* Your recent tickets */}
          {me ? (
            <Card>
              <CardContent className="p-0">
                <div className="p-4">
                  <h2 className="text-lg font-semibold">Your recent requests</h2>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Subject / Message</TableHead>
                      <TableHead className="w-[20%]">Type</TableHead>
                      <TableHead className="w-[25%]">Target</TableHead>
                      <TableHead className="w-[15%]">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.length ? (
                      recent.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="truncate">{(r.reason ?? "").split("\n")[0] || "(no subject)"}</TableCell>
                          <TableCell className="truncate">{r.target_type}</TableCell>
                          <TableCell className="truncate">
                            <code className="text-xs">{r.target_id}</code>
                          </TableCell>
                          <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          No requests yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Contact form */}
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-lg font-semibold">Contact support</h2>
              {!authUser ? (
                <div className="rounded-md border px-3 py-2 text-sm">
                  Please <Link href="/login" className="text-blue-600 hover:underline">sign in</Link> to send a request.
                </div>
              ) : (
                <form action={createTicket} className="space-y-3">
                  <div>
                    <label htmlFor="subject" className="block text-sm text-muted-foreground">Subject</label>
                    <input
                      id="subject"
                      name="subject"
                      className="mt-1 w-full rounded-md border px-3 py-2"
                      placeholder="Brief summary"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm text-muted-foreground">Message</label>
                    <textarea
                      id="message"
                      name="message"
                      className="mt-1 w-full rounded-md border px-3 py-2"
                      placeholder="Describe the issue or question…"
                      rows={5}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label htmlFor="type" className="block text-sm text-muted-foreground">Type</label>
                      <select id="type" name="type" className="mt-1 w-full rounded-md border px-3 py-2 bg-white" defaultValue="support">
                        <option value="support">General support</option>
                        <option value="project">Project issue</option>
                        <option value="user">User issue</option>
                        <option value="message">Message/report</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="targetId" className="block text-sm text-muted-foreground">Target ID (optional)</label>
                      <input
                        id="targetId"
                        name="targetId"
                        className="mt-1 w-full rounded-md border px-3 py-2"
                        placeholder="UUID of project/user/message"
                      />
                    </div>
                  </div>
                  <div className="pt-1">
                    <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
                      Submit request
                    </button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold">Quick links</h3>
              <ul className="mt-2 list-disc pl-5 text-sm">
                <li><Link href="/projects" className="text-blue-600 hover:underline">Browse projects</Link></li>
                <li><Link href="/providers" className="text-blue-600 hover:underline">Find providers</Link></li>
                <li><Link href="/pricing" className="text-blue-600 hover:underline">Pricing & fees</Link></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
