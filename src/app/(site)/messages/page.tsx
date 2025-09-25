// src/app/(site)/messages/page.tsx
import Link from "next/link";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

type ConvoMemberJoined = { convo_id: string; conversations: ConversationRow | null };
type AppUser = { id: string; auth_id: string | null; email: string | null };

type ConversationRow = {
  id: string;
  project_id: string | null;
  created_at: string;
};

type MemberRow = { convo_id: string; user_id: string };
type MessageRow = {
  id: string;
  convo_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
};
type ProjectLite = { id: string; title: string };
type ProfileLite = { user_id: string; display_name: string | null };

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

export default async function MessagesPage() {
  const [auth, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  if (!auth) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <h1 className="text-2xl sm:text-3xl font-bold">Messages</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            Please{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              sign in
            </Link>{" "}
            to view your messages.
          </CardContent>
        </Card>
      </div>
    );
  }

  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <h1 className="text-2xl sm:text-3xl font-bold">Messages</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            We couldn’t find your account record.
          </CardContent>
        </Card>
      </div>
    );
  }

  // 1) Find my conversations
  const { data: cm } = await supabase
    .from("conversation_members")
    .select("convo_id,conversations(id,project_id,created_at)")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false });

  const convos: ConvoMemberJoined[] = (cm as ConvoMemberJoined[] | null) ?? [];
  const convoList: ConversationRow[] = convos
    .map((r) => (r.conversations ? r.conversations : null))
    .filter(Boolean) as ConversationRow[];

  if (convoList.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Messages</h1>
          <Link
            href="/providers"
            className="rounded-md border px-4 py-2 text-sm text-center"
          >
            Find providers
          </Link>
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No conversations yet. Invite a provider from their profile to start a chat.
          </CardContent>
        </Card>
      </div>
    );
  }

  const convoIds = convoList.map((c) => c.id);

  // 2) Members of those conversations (to show counterpart names)
  const { data: members } = await supabase
    .from("conversation_members")
    .select("convo_id,user_id")
    .in("convo_id", convoIds);
  const memberRows: MemberRow[] = (members as MemberRow[] | null) ?? [];

  const otherByConvo = new Map<string, string | null>();
  for (const c of convoIds) {
    const usersIn = memberRows.filter((m) => m.convo_id === c).map((m) => m.user_id);
    const other = usersIn.find((u) => u !== me.id) ?? null;
    otherByConvo.set(c, other);
  }

  const otherUserIds = Array.from(
    new Set(Array.from(otherByConvo.values()).filter((v): v is string => !!v))
  );
  let profiles = new Map<string, ProfileLite>();
  if (otherUserIds.length) {
    const { data: profs } = await supabase
      .from("user_profiles")
      .select("user_id,display_name")
      .in("user_id", otherUserIds);
    profiles = new Map(((profs as ProfileLite[] | null) ?? []).map((p) => [p.user_id, p]));
  }

  // 3) Latest messages per conversation (fetch recent batch then pick first per convo)
  const { data: msgs } = await supabase
    .from("messages")
    .select("id,convo_id,sender_id,body,created_at")
    .in("convo_id", convoIds)
    .order("created_at", { ascending: false })
    .limit(500);
  const recent: MessageRow[] = (msgs as MessageRow[] | null) ?? [];

  const latestByConvo = new Map<string, MessageRow>();
  for (const m of recent) {
    if (!latestByConvo.has(m.convo_id)) latestByConvo.set(m.convo_id, m);
  }

  // 4) Load project titles
  const projectIds = Array.from(
    new Set(convoList.map((c) => c.project_id).filter(Boolean))
  ) as string[];
  const projMap = new Map<string, ProjectLite>();
  if (projectIds.length) {
    const { data: projs } = await supabase.from("projects").select("id,title").in("id", projectIds);
    ((projs as ProjectLite[] | null) ?? []).forEach((p) => projMap.set(p.id, p));
  }

  // Sort conversations by latest message time (fallback to created_at)
  const sorted = [...convoList].sort((a, b) => {
    const la = latestByConvo.get(a.id)?.created_at ?? a.created_at;
    const lb = latestByConvo.get(b.id)?.created_at ?? b.created_at;
    return la < lb ? 1 : la > lb ? -1 : 0;
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">Messages</h1>
        <Link
          href="/providers"
          className="rounded-md border px-4 py-2 text-sm text-center"
        >
          Find providers
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {sorted.map((c) => {
              const last = latestByConvo.get(c.id) ?? null;
              const otherId = otherByConvo.get(c.id);
              const otherName =
                (otherId ? profiles.get(otherId)?.display_name : null) ?? "Conversation";
              const proj = c.project_id ? projMap.get(c.project_id) : undefined;

              return (
                <li key={c.id}>
                  <Link
                    href={`/messages/${c.id}`}
                    className="block px-4 py-4 hover:bg-muted/50 focus:bg-muted/50 focus:outline-none sm:px-5"
                  >
                    <div className="flex items-start gap-3">
                      {/* Placeholder avatar bubble (initial) for mobile visual balance */}
                      <div className="mt-0.5 hidden xs:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                        {otherName.slice(0, 1).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate font-medium">{otherName}</div>
                          {last ? (
                            <time
                              suppressHydrationWarning
                              dateTime={last.created_at}
                              className="shrink-0 text-xs text-muted-foreground"
                            >
                              {new Date(last.created_at).toLocaleString()}
                            </time>
                          ) : null}
                        </div>

                        {proj ? (
                          <div className="mt-0.5 text-xs text-muted-foreground truncate">
                            Project: <span className="font-medium">{proj.title}</span>
                          </div>
                        ) : null}

                        <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {last?.body ?? "No messages yet."}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
