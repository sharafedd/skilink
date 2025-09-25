// src/app/(site)/notifications/page.tsx
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

type AppUser = { id: string; auth_id: string | null; email: string | null };

type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

type SearchParams = { f?: "all" | "unread"; page?: string };

const PAGE_SIZE = 20;

/* ----------------- Helpers ----------------- */
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

function qs(base: Record<string, string | undefined>, up: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  const merged = { ...base, ...up };
  for (const [k, v] of Object.entries(merged)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function payloadStr(p: Record<string, unknown> | null, key: string): string | undefined {
  if (!p) return undefined;
  const v = p[key];
  return typeof v === "string" ? v : undefined;
}

function summarize(n: NotificationRow): { title: string; body?: string; href?: string } {
  const k = n.kind;
  const p = n.payload ?? {};
  if (k === "new_message") {
    const convoId = payloadStr(p, "convo_id");
    return {
      title: "New message",
      body: "You’ve received a new message.",
      href: convoId ? `/messages/${encodeURIComponent(convoId)}` : undefined,
    };
  }
  if (k === "invite_to_project") {
    const title = payloadStr(p, "title");
    const projectId = payloadStr(p, "project_id");
    return {
      title: "Project invite",
      body: title ? `Invitation to: ${title}` : "You’ve been invited to a project.",
      href: projectId ? `/projects/${encodeURIComponent(projectId)}` : undefined,
    };
  }
  if (k === "support_ticket") {
    const subject = payloadStr(p, "subject");
    return {
      title: "Support ticket update",
      body: subject,
      href: "/contact",
    };
  }
  // Fallback
  return {
    title: k.replace(/_/g, " "),
    body: typeof p["message"] === "string" ? (p["message"] as string) : undefined,
  };
}

/* ----------------- Server actions ----------------- */
async function markRead(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");
  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return;

  await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", me.id);
  revalidatePath("/notifications");
}

async function markUnread(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");
  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return;

  await supabase.from("notifications").update({ is_read: false }).eq("id", id).eq("user_id", me.id);
  revalidatePath("/notifications");
}

async function markAllRead() {
  "use server";
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");
  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return;

  await supabase.from("notifications").update({ is_read: true }).eq("user_id", me.id).eq("is_read", false);
  revalidatePath("/notifications");
}

async function deleteNotification(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");
  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return;

  await supabase.from("notifications").delete().eq("id", id).eq("user_id", me.id);
  revalidatePath("/notifications");
}

/* ----------------- Page ----------------- */
export default async function NotificationsPage({ searchParams }: { searchParams?: SearchParams }) {
  const [auth, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  if (!auth) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            Please <Link href="/login" className="text-blue-600 hover:underline">sign in</Link> to view notifications.
          </CardContent>
        </Card>
      </div>
    );
  }

  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <Card><CardContent className="p-6 text-sm">We couldn’t find your account record.</CardContent></Card>
      </div>
    );
  }

  const filter: "all" | "unread" = searchParams?.f === "unread" ? "unread" : "all";
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from("notifications")
    .select("id,user_id,kind,payload,is_read,created_at", { count: "exact" })
    .eq("user_id", me.id)
    .order("created_at", { ascending: false });

  if (filter === "unread") q = q.eq("is_read", false);

  const { data, count } = await q.range(from, to);
  const rows: NotificationRow[] = (data as NotificationRow[] | null) ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const baseParams: Record<string, string | undefined> = {
    f: filter === "all" ? undefined : "unread",
    page: String(page),
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <div className="inline-flex rounded-md border p-1">
          <Link
            href={`/notifications${qs(baseParams, { f: "all", page: "1" })}`}
            className={`px-3 py-1.5 text-sm rounded-md ${filter === "all" ? "bg-black text-white" : ""}`}
          >
            All
          </Link>
          <Link
            href={`/notifications${qs(baseParams, { f: "unread", page: "1" })}`}
            className={`px-3 py-1.5 text-sm rounded-md ${filter === "unread" ? "bg-black text-white" : ""}`}
          >
            Unread
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {count ?? 0} {filter === "unread" ? "unread" : "total"} notification{(count ?? 0) === 1 ? "" : "s"}
        </div>
        <form action={markAllRead}>
          <button className="rounded-md border px-3 py-1.5 text-sm">Mark all as read</button>
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {rows.length ? (
              rows.map((n) => {
                const summary = summarize(n);
                return (
                  <li key={n.id} className={`px-4 py-3 ${n.is_read ? "opacity-70" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!n.is_read ? <span className="inline-block size-2 rounded-full bg-black" /> : null}
                          <div className="font-medium truncate">{summary.title}</div>
                        </div>
                        {summary.body ? (
                          <div className="mt-0.5 text-sm text-muted-foreground truncate">{summary.body}</div>
                        ) : null}
                        <div className="mt-1 text-xs text-muted-foreground">
                          <time suppressHydrationWarning dateTime={n.created_at}>
                            {new Date(n.created_at).toLocaleString()}
                          </time>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {summary.href ? (
                          <Link href={summary.href} className="rounded-md border px-2.5 py-1.5 text-sm">
                            Open
                          </Link>
                        ) : null}
                        {n.is_read ? (
                          <form action={markUnread}>
                            <input type="hidden" name="id" value={n.id} />
                            <button className="rounded-md border px-2.5 py-1.5 text-sm" title="Mark as unread">
                              Unread
                            </button>
                          </form>
                        ) : (
                          <form action={markRead}>
                            <input type="hidden" name="id" value={n.id} />
                            <button className="rounded-md border px-2.5 py-1.5 text-sm" title="Mark as read">
                              Read
                            </button>
                          </form>
                        )}
                        <form action={deleteNotification}>
                          <input type="hidden" name="id" value={n.id} />
                          <button className="rounded-md border px-2.5 py-1.5 text-sm" title="Delete">
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">No notifications.</li>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
        </div>
        <div className="flex gap-2">
          <Link
            href={page > 1 ? `/notifications${qs(baseParams, { page: String(page - 1) })}` : "#"}
            aria-disabled={page <= 1}
            className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
          >
            Previous
          </Link>
          <Link
            href={page < totalPages ? `/notifications${qs(baseParams, { page: String(page + 1) })}` : "#"}
            aria-disabled={page >= totalPages}
            className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
