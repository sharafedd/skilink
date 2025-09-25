// src/app/(site)/providers/[id]/invite/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

/* ================= Types ================= */

type MinimalUser = { id: string; auth_id: string | null; email: string | null };

type ProjectRow = {
  id: string;
  title: string;
  status:
    | "draft"
    | "open"
    | "paused"
    | "in_review"
    | "assigned"
    | "completed"
    | "cancelled";
};

type ProjectLiteForInvite = { id: string; buyer_id: string; title: string };

type ProviderNameRow = { user_id: string; display_name: string | null };

/* =============== Helpers =============== */

async function resolveOrCreateAppUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerRO>>,
  authId: string,
  email: string | null
): Promise<MinimalUser | null> {
  const { data: byAuth } = await supabase
    .from("users")
    .select("id,auth_id,email")
    .eq("auth_id", authId)
    .limit(1)
    .maybeSingle();
  if (byAuth) return byAuth as MinimalUser;

  if (email) {
    const { data: byEmail } = await supabase
      .from("users")
      .select("id,auth_id,email")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    const row = byEmail as MinimalUser | null;
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

  return (created as MinimalUser | null) ?? null;
}

/* =============== Server Action =============== */

async function sendInvite(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");

  const provider_id = String(formData.get("provider_id") || "");
  const project_id = String(formData.get("project_id") || "");
  const message = String(formData.get("message") || "").trim();

  if (!provider_id || !project_id) return redirect(`/providers/${provider_id}/invite`);

  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return redirect("/login");

  // Ensure selected project belongs to the current user
  const { data: proj } = await supabase
    .from("projects")
    .select("id,buyer_id,title")
    .eq("id", project_id)
    .limit(1)
    .maybeSingle();

  const project = proj as ProjectLiteForInvite | null;
  if (!project || project.buyer_id !== me.id) {
    return redirect(`/providers/${provider_id}/invite`);
  }

  // Notify provider
  const payload: Record<string, unknown> = {
    project_id,
    buyer_id: me.id,
    message,
    title: project.title,
  };
  await supabase.from("notifications").insert({
    user_id: provider_id,
    kind: "invite_to_project",
    payload,
  });

  // Create a conversation and initial message (optional)
  const { data: convo } = await supabase
    .from("conversations")
    .insert({ project_id })
    .select("id")
    .single();

  const convoId = (convo as { id: string } | null)?.id;
  if (convoId) {
    await supabase.from("conversation_members").insert([
      { convo_id: convoId, user_id: me.id },
      { convo_id: convoId, user_id: provider_id },
    ]);
    if (message) {
      await supabase.from("messages").insert({
        convo_id: convoId,
        sender_id: me.id,
        body: message,
      });
    }
  }

  revalidatePath(`/providers/${provider_id}`);
  redirect(`/providers/${provider_id}`);
}

/* =============== Page =============== */

export default async function ProviderInvitePage({ params }: { params: { id: string } }) {
  const providerId = params.id;
  const [auth, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  if (!auth) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Invite provider</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            Please{" "}
            <Link href="/auth/sign-in" className="text-blue-600 hover:underline">
              sign in
            </Link>{" "}
            to invite a provider.
          </CardContent>
        </Card>
      </div>
    );
  }

  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return null;

  // Load user's eligible projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id,title,status")
    .eq("buyer_id", me.id)
    .in("status", ["draft", "open", "in_review"])
    .order("created_at", { ascending: false });

  const myProjects: ProjectRow[] = (projects as ProjectRow[] | null) ?? [];

  // Provider name for header
  const { data: prov } = await supabase
    .from("provider_profiles")
    .select("user_id,display_name")
    .eq("user_id", providerId)
    .limit(1)
    .maybeSingle();
  const providerName = ((prov as ProviderNameRow | null)?.display_name ?? "Provider");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header stacks on mobile */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">Invite {providerName}</h1>
        <Link
          href={`/providers/${providerId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to profile
        </Link>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {myProjects.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              You have no eligible projects.{" "}
              <Link href="/projects/new" className="text-blue-600 hover:underline">
                Create a project
              </Link>{" "}
              first.
            </div>
          ) : (
            <form action={sendInvite} className="space-y-4">
              <input type="hidden" name="provider_id" value={providerId} />
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground">
                  Project
                </label>
                <select
                  name="project_id"
                  className="mt-1 w-full rounded-md border px-3 py-2 bg-white"
                  required
                >
                  {myProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} {p.status !== "open" ? `· ${p.status}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground">
                  Message (optional)
                </label>
                <textarea
                  name="message"
                  rows={5}
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  placeholder="Introduce your project, timeline and budget…"
                />
              </div>
              {/* Actions: stack on mobile */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Link
                  href={`/providers/${providerId}`}
                  className="rounded-md border px-4 py-2 text-center"
                >
                  Cancel
                </Link>
                <button className="rounded-md bg-black px-4 py-2 text-white">
                  Send invite
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
