import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/* ---------------- Types ---------------- */

type Tab = "projects" | "providers";

type SearchParams = {
  t?: Tab | string;
  page?: string;
};

type FavoriteRow = {
  id: string;
  user_id: string;
  favorite_type: "provider" | "project" | string;
  target_id: string;
  created_at: string;
};

type Project = {
  id: string;
  title: string;
  status: "draft" | "open" | "paused" | "in_review" | "assigned" | "completed" | "cancelled";
  budget_kind: "fixed" | "hourly";
  budget_amount: number | null;
  hourly_min: number | null;
  hourly_max: number | null;
  city: string | null;
  country: string | null;
  created_at: string;
};

type ProviderProfile = {
  user_id: string;
  display_name: string | null;
  verified: boolean | null;
  hourly_rate: number | null;
  years_experience: number | null;
  created_at: string;
};

type UserProfile = {
  user_id: string;
  city: string | null;
  wilaya?: string | null;
  commune?: string | null;
  country: string | null;
};

const PAGE_SIZE = 20;

/* ---------------- Utils ---------------- */

function buildQueryString(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>
) {
  const merged = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...updates })) {
    if (v && v.length) merged.set(k, v);
    if (v === "") merged.delete(k);
  }
  const s = merged.toString();
  return s ? `?${s}` : "";
}

function BudgetCell(p: Project) {
  if (p.budget_kind === "fixed") {
    return <span>{p.budget_amount != null ? `${p.budget_amount} DZD` : "—"}</span>;
  }
  return (
    <span>
      {p.hourly_min != null ? p.hourly_min : "—"}–{p.hourly_max != null ? p.hourly_max : "—"} DZD/h
    </span>
  );
}

function ProjectLocation(p: Project) {
  const txt = [p.city, p.country].filter(Boolean).join(", ");
  return <span>{txt || "Remote"}</span>;
}

function ProviderLocation({ up }: { up?: UserProfile }) {
  if (!up) return <span>—</span>;
  const txt = [up.commune ?? up.city, up.wilaya, up.country].filter(Boolean).join(", ");
  return <span>{txt || "—"}</span>;
}

function Tabs({ current }: { current: Tab }) {
  const tabs: Tab[] = ["projects", "providers"];
  return (
    <div className="flex gap-2 border-b">
      {tabs.map((t) => (
        <Link
          key={t}
          href={`/saved${buildQueryString({ t: current, page: "1" }, { t })}`}
          className={`px-3 py-2 border-b-2 ${
            current === t ? "border-black font-semibold" : "border-transparent text-muted-foreground"
          }`}
        >
          {t[0].toUpperCase() + t.slice(1)}
        </Link>
      ))}
    </div>
  );
}

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
          href={page > 1 ? `/saved${buildQueryString(baseParams, { page: String(page - 1) })}` : "#"}
          aria-disabled={page <= 1}
          className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
        >
          Previous
        </Link>
        <Link
          href={page < totalPages ? `/saved${buildQueryString(baseParams, { page: String(page + 1) })}` : "#"}
          aria-disabled={page >= totalPages}
          className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

/* ---------------- Server Action (remove favorite) ---------------- */

async function removeFavorite(formData: FormData) {
  "use server";
  const favId = String(formData.get("id") || "");
  if (!favId) return;

  const [supabase, authUser] = await Promise.all([createSupabaseServerRO(), getCurrentUser()]);
  if (!authUser) return;

  // Resolve app user id from auth id
  const { data: appUser } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();

  const appUserId = appUser?.id;
  if (!appUserId) return;

  await supabase.from("favorites").delete().eq("id", favId).eq("user_id", appUserId);
  revalidatePath("/saved");
}

/* ---------------- Page ---------------- */

export default async function SavedPage({ searchParams }: { searchParams?: SearchParams }) {
  const [authUser, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  if (!authUser) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Saved</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            Please <Link href="/login" className="text-blue-600 hover:underline">sign in</Link> to view your saved projects and providers.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Map auth user -> app user id
  const { data: appUser } = await supabase
    .from("users")
    .select("id,auth_id,email")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();

  const appUserId = appUser?.id;
  if (!appUserId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Saved</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            We couldn’t find your account record. If this persists, contact support.
          </CardContent>
        </Card>
      </div>
    );
  }

  const t: Tab =
    (["projects", "providers"].includes((searchParams?.t as string) || "")
      ? (searchParams?.t as Tab)
      : "projects");

  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const baseParams: Record<string, string | undefined> = {
    t,
    page: String(page),
  };

  // --------- PROJECTS TAB ---------
  if (t === "projects") {
    const { data: favs, count, error } = await supabase
      .from("favorites")
      .select("id,user_id,favorite_type,target_id,created_at", { count: "exact" })
      .eq("user_id", appUserId)
      .eq("favorite_type", "project")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">Saved</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            Failed to load favorites: {error.message}
          </div>
        </div>
      );
    }

    const favRows: FavoriteRow[] = (favs as FavoriteRow[] | null) ?? [];
    const projIds = favRows.map((f) => f.target_id);
    const projMap = new Map<string, Project>();
    if (projIds.length) {
      const { data: projs } = await supabase
        .from("projects")
        .select("id,title,status,budget_kind,budget_amount,hourly_min,hourly_max,city,country,created_at")
        .in("id", projIds);
      (projs as Project[] | null)?.forEach((p) => projMap.set(p.id, p));
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Saved</h1>
        <Tabs current={t} />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36%]">Project</TableHead>
                  <TableHead className="w-[18%]">Budget</TableHead>
                  <TableHead className="w-[18%]">Location</TableHead>
                  <TableHead className="w-[13%]">Status</TableHead>
                  <TableHead className="w-[15%]">Saved on</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {favRows.length ? (
                  favRows.map((f) => {
                    const p = projMap.get(f.target_id);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="truncate">
                          {p ? (
                            <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline">
                              {p.title}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">[deleted]</span>
                          )}
                        </TableCell>
                        <TableCell>{p ? <BudgetCell {...p} /> : "—"}</TableCell>
                        <TableCell>{p ? <ProjectLocation {...p} /> : "—"}</TableCell>
                        <TableCell>
                          {p ? (
                            <Badge variant={p.status === "open" ? undefined : "outline"}>
                              {p.status.replace("_", " ")}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="flex items-center justify-between gap-3">
                            <time suppressHydrationWarning dateTime={f.created_at}>
                              {new Date(f.created_at).toLocaleString()}
                            </time>
                            <form action={removeFavorite}>
                              <input type="hidden" name="id" value={f.id} />
                              <button className="rounded-md border px-2 py-1 text-xs" aria-label="Remove favorite">
                                Remove
                              </button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No saved projects yet.
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

  // --------- PROVIDERS TAB ---------
  {
    const { data: favs, count, error } = await supabase
      .from("favorites")
      .select("id,user_id,favorite_type,target_id,created_at", { count: "exact" })
      .eq("user_id", appUserId)
      .eq("favorite_type", "provider")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">Saved</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            Failed to load favorites: {error.message}
          </div>
        </div>
      );
    }

    const favRows: FavoriteRow[] = (favs as FavoriteRow[] | null) ?? [];
    const providerIds = favRows.map((f) => f.target_id);

    // Provider profiles
    const providerMap = new Map<string, ProviderProfile>();
    if (providerIds.length) {
      const { data: provs } = await supabase
        .from("provider_profiles")
        .select("user_id,display_name,verified,hourly_rate,years_experience,created_at")
        .in("user_id", providerIds);
      (provs as ProviderProfile[] | null)?.forEach((p) => providerMap.set(p.user_id, p));
    }

    // Locations
    const profileMap = new Map<string, UserProfile>();
    if (providerIds.length) {
      const { data: profs } = await supabase
        .from("user_profiles")
        .select("user_id,city,wilaya,commune,country")
        .in("user_id", providerIds);
      (profs as UserProfile[] | null)?.forEach((p) => profileMap.set(p.user_id, p));
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Saved</h1>
        <Tabs current={t} />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%]">Provider</TableHead>
                  <TableHead className="w-[16%]">Verified</TableHead>
                  <TableHead className="w-[18%]">Rate (DZD/h)</TableHead>
                  <TableHead className="w-[18%]">Location</TableHead>
                  <TableHead className="w-[14%]">Saved on</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {favRows.length ? (
                  favRows.map((f) => {
                    const pr = providerMap.get(f.target_id);
                    const up = profileMap.get(f.target_id);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="truncate">
                          {pr ? (
                            <Link href={`/providers/${pr.user_id}`} className="text-blue-600 hover:underline">
                              {pr.display_name ?? "Unnamed provider"}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">[deleted]</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {pr ? (pr.verified ? <Badge>Verified</Badge> : <Badge variant="outline">Unverified</Badge>) : "—"}
                        </TableCell>
                        <TableCell>{pr?.hourly_rate != null ? pr.hourly_rate : "—"}</TableCell>
                        <TableCell><ProviderLocation up={up} /></TableCell>
                        <TableCell className="align-middle">
                          <div className="flex items-center justify-between gap-3">
                            <time suppressHydrationWarning dateTime={f.created_at}>
                              {new Date(f.created_at).toLocaleString()}
                            </time>
                            <form action={removeFavorite}>
                              <input type="hidden" name="id" value={f.id} />
                              <button className="rounded-md border px-2 py-1 text-xs" aria-label="Remove favorite">
                                Remove
                              </button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No saved providers yet.
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
}
