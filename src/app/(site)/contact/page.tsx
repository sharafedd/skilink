// src/app/(site)/contact/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

type AppUser = { id: string; auth_id: string | null; email: string | null };

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
      await supabase
        .from("users")
        .update({ auth_id: authId, updated_at: new Date().toISOString() })
        .eq("id", row.id);
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

/* ===== Server action: submit contact ===== */
async function submitContact(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");

  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return redirect("/login");

  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  if (!subject && !message) return redirect("/contact");

  // Store as a generic support ticket in `reports`
  const reason = subject ? `${subject}\n\n${message}` : message;
  await supabase.from("reports").insert({
    reporter_id: me.id,
    target_type: "support",
    target_id: me.id,
    reason,
  });

  // Ping all admins via notifications (optional)
  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin");
  const adminIds = ((admins as Array<{ id: string }> | null) ?? []).map((a) => a.id);
  if (adminIds.length) {
    await supabase.from("notifications").insert(
      adminIds.map((adminId) => ({
        user_id: adminId,
        kind: "support_ticket",
        payload: { reporter_id: me.id, subject, message },
      }))
    );
  }

  revalidatePath("/contact");
  redirect("/contact?submitted=1");
}

/* ===== Page ===== */
export default async function ContactPage({
  searchParams,
}: {
  searchParams?: { submitted?: string };
}) {
  const [authUser, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  const submitted = searchParams?.submitted === "1";

  // Optional: show user email if signed in
  let me: AppUser | null = null;
  if (authUser) {
    const { data: u } = await supabase
      .from("users")
      .select("id,auth_id,email")
      .eq("auth_id", authUser.id)
      .limit(1)
      .maybeSingle();
    me = (u as AppUser | null) ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Contact us</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Home
        </Link>
      </div>

      {submitted ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm">
          Thanks! Your message was sent. We’ll get back to you soon.
        </div>
      ) : null}

      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Questions, feedback, or an issue? Send us a message below.
          </p>

          {!authUser ? (
            <div className="rounded-md border px-3 py-2 text-sm">
              Please{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                sign in
              </Link>{" "}
              to contact support.
            </div>
          ) : (
            <form action={submitContact} className="space-y-4">
              <div>
                <label htmlFor="subject" className="block text-sm text-muted-foreground">
                  Subject
                </label>
                <input
                  id="subject"
                  name="subject"
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  placeholder="Brief summary"
                  required
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm text-muted-foreground">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  placeholder="Describe your request…"
                  required
                />
              </div>
              {me?.email ? (
                <div className="text-xs text-muted-foreground">
                  From: <span className="font-medium">{me.email}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <Link href="/" className="rounded-md border px-4 py-2">
                  Cancel
                </Link>
                <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
                  Send
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Other ways to reach us</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>
              Knowledge base: <Link href="/help" className="text-blue-600 hover:underline">Help Center</Link>
            </li>
            <li>
              Email: <a href="mailto:support@skilink.example" className="text-blue-600 hover:underline">support@skilink.example</a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
