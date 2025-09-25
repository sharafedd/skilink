import Link from "next/link";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SearchParams = {
  q?: string;                  // provider name
  verified?: "yes" | "no" | "";
  cat?: string;                // category slug
  skill?: string;              // skill slug
  wilaya?: string;             // wilaya/city text
  minRate?: string;            // number
  maxRate?: string;            // number
  exp?: string;                // min years experience
  page?: string;
};

type ProviderRow = {
  user_id: string;
  display_name: string | null;
  hourly_rate: number | null;
  min_project_value: number | null;
  years_experience: number | null;
  on_site: boolean | null;
  remote: boolean | null;
  verified: boolean | null;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  wilaya?: string | null;
  commune?: string | null;
  city?: string | null;
  country?: string | null;
};

type Category = { id: string; name: string; slug: string };

const PAGE_SIZE = 20;

function buildQueryString(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>
) {
  const merged = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...updates })) {
    if (v && v.length) merged.set(k, v);
    if (v === "") merged.delete(k);
  }
  if (
    "q" in updates || "verified" in updates || "cat" in updates || "skill" in updates ||
    "wilaya" in updates || "minRate" in updates || "maxRate" in updates || "exp" in updates
  ) {
    merged.set("page", "1");
  }
  const s = merged.toString();
  return s ? `?${s}` : "";
}

function LocationText(p?: ProfileRow) {
  if (!p) return "—";
  const parts = [p.commune ?? p.city, p.wilaya].filter(Boolean).join(", ");
  return parts || "—";
}

export default async function ProvidersPage({ searchParams }: { searchParams?: SearchParams }) {
  const supabase = await createSupabaseServerRO();

  const q = (searchParams?.q ?? "").trim();
  const verified = (searchParams?.verified as "yes" | "no" | "") || "";
  const catSlug = (searchParams?.cat ?? "").trim();
  const skillSlug = (searchParams?.skill ?? "").trim();
  const wilaya = (searchParams?.wilaya ?? "").trim();
  const minRate = Number.isFinite(Number(searchParams?.minRate)) ? Number(searchParams?.minRate) : undefined;
  const maxRate = Number.isFinite(Number(searchParams?.maxRate)) ? Number(searchParams?.maxRate) : undefined;
  const expMin = Number.isFinite(Number(searchParams?.exp)) ? Number(searchParams?.exp) : undefined;

  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // --- Resolve category/skill/wilaya to user_id sets (for intersection) ---
  // Category
  let idsByCategory: string[] | undefined;
  if (catSlug) {
    const { data: cat } = await supabase
      .from("service_categories")
      .select("id,slug")
      .eq("slug", catSlug)
      .limit(1)
      .single();
    const catId = (cat as { id: string } | null)?.id;
    if (catId) {
      const { data } = await supabase
        .from("provider_services")
        .select("user_id")
        .eq("category_id", catId);
      idsByCategory = ((data as Array<{ user_id: string }> | null) ?? []).map((r) => r.user_id);
    } else {
      idsByCategory = []; // no such category -> empty
    }
  }

  // Skill
  let idsBySkill: string[] | undefined;
  if (skillSlug) {
    const { data: skill } = await supabase
      .from("skills")
      .select("id,slug")
      .eq("slug", skillSlug)
      .limit(1)
      .single();
    const skillId = (skill as { id: string } | null)?.id;
    if (skillId) {
      const { data } = await supabase
        .from("provider_skills")
        .select("user_id")
        .eq("skill_id", skillId);
      idsBySkill = ((data as Array<{ user_id: string }> | null) ?? []).map((r) => r.user_id);
    } else {
      idsBySkill = [];
    }
  }

  // Wilaya / city
  let idsByWilaya: string[] | undefined;
  if (wilaya) {
    const { data } = await supabase
      .from("user_profiles")
      .select("user_id")
      .or(`wilaya.ilike.%${wilaya}%,city.ilike.%${wilaya}%,commune.ilike.%${wilaya}%`);
    idsByWilaya = ((data as Array<{ user_id: string }> | null) ?? []).map((r) => r.user_id);
  }

  // Intersect id sets if any of them are present
  function intersect(a?: string[], b?: string[]) {
    if (!a) return b;
    if (!b) return a;
    const setB = new Set(b);
    return a.filter((x) => setB.has(x));
  }
  let idsFilter: string[] | undefined = undefined;
  idsFilter = intersect(idsFilter, idsByCategory);
  idsFilter = intersect(idsFilter, idsBySkill);
  idsFilter = intersect(idsFilter, idsByWilaya);
  if (idsFilter && idsFilter.length === 0) {
    // Short-circuit empty result
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Header />
        <Filters q={q} verified={verified} cat={catSlug} skill={skillSlug} wilaya={wilaya}
          minRate={minRate} maxRate={maxRate} expMin={expMin} currentPage={page} />
        <p className="text-sm text-muted-foreground">No providers found.</p>
      </div>
    );
  }

  // --- Base provider query with count/pagination ---
  let query = supabase
    .from("provider_profiles")
    .select("user_id,display_name,hourly_rate,min_project_value,years_experience,on_site,remote,verified,created_at", { count: "exact" })
    .order("verified", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) query = query.ilike("display_name", `%${q}%`);
  if (verified === "yes") query = query.eq("verified", true);
  if (verified === "no") query = query.eq("verified", false);
  if (typeof minRate === "number") query = query.gte("hourly_rate", minRate);
  if (typeof maxRate === "number") query = query.lte("hourly_rate", maxRate);
  if (typeof expMin === "number") query = query.gte("years_experience", expMin);
  if (idsFilter) query = query.in("user_id", idsFilter);

  const { data: providers, count, error } = await query;
  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">Providers</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          Failed to load providers: {error.message}
        </div>
      </div>
    );
  }

  const rows: ProviderRow[] = (providers as ProviderRow[] | null) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ids = rows.map((r) => r.user_id);

  // Join user_profiles for location
  const profilesMap = new Map<string, ProfileRow>();
  if (ids.length) {
    const { data: profs } = await supabase
      .from("user_profiles")
      .select("user_id,wilaya,commune,city,country")
      .in("user_id", ids);
    ((profs as ProfileRow[] | null) ?? []).forEach((p) => profilesMap.set(p.user_id, p));
  }

  // Load up to 2 categories per provider (names)
  const svcNames = new Map<string, string[]>(); // user_id -> names
  if (ids.length) {
    const { data: svc } = await supabase
      .from("provider_services")
      .select("user_id,category_id")
      .in("user_id", ids);
    const catIds = new Set<string>(((svc as Array<{ user_id: string; category_id: string }> | null) ?? []).map((s) => s.category_id));
    const catMap = new Map<string, Category>();
    if (catIds.size) {
      const { data: cats } = await supabase
        .from("service_categories")
        .select("id,name,slug")
        .in("id", Array.from(catIds));
      ((cats as Category[] | null) ?? []).forEach((c) => catMap.set(c.id, c));
    }
    ((svc as Array<{ user_id: string; category_id: string }> | null) ?? []).forEach((s) => {
      const arr = svcNames.get(s.user_id) ?? [];
      const cat = catMap.get(s.category_id);
      if (cat) arr.push(cat.name);
      svcNames.set(s.user_id, arr.slice(0, 2)); // cap at 2
    });
  }

  const baseParams: Record<string, string | undefined> = {
    q: q || undefined,
    verified: verified || undefined,
    cat: catSlug || undefined,
    skill: skillSlug || undefined,
    wilaya: wilaya || undefined,
    minRate: typeof minRate === "number" ? String(minRate) : undefined,
    maxRate: typeof maxRate === "number" ? String(maxRate) : undefined,
    exp: typeof expMin === "number" ? String(expMin) : undefined,
    page: String(page),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Header />
      <Filters q={q} verified={verified} cat={catSlug} skill={skillSlug} wilaya={wilaya}
        minRate={minRate} maxRate={maxRate} expMin={expMin} currentPage={page} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.length ? (
          rows.map((pr) => {
            const loc = profilesMap.get(pr.user_id);
            const cats = svcNames.get(pr.user_id) ?? [];
            return (
              <Card key={pr.user_id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/providers/${pr.user_id}`}
                      className="text-lg font-semibold hover:underline truncate"
                    >
                      {pr.display_name ?? "Unnamed provider"}
                    </Link>
                    {pr.verified ? <Badge>Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    {cats.map((n) => (
                      <Badge key={n} variant="outline">{n}</Badge>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(pr.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div><span className="text-muted-foreground">Rate:&nbsp;</span>{pr.hourly_rate != null ? `${pr.hourly_rate} DZD/h` : "—"}</div>
                    <div><span className="text-muted-foreground">Experience:&nbsp;</span>{pr.years_experience != null ? `${pr.years_experience} yrs` : "—"}</div>
                    <div><span className="text-muted-foreground">Location:&nbsp;</span>{LocationText(loc)}</div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/providers/${pr.user_id}`} className="rounded-md border px-3 py-2 text-sm" prefetch={false}>
                      View profile
                    </Link>
                    <Link href={`/projects/new?invite=${pr.user_id}`} className="rounded-md bg-black px-3 py-2 text-sm text-white" prefetch={false}>
                      Invite to project
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No providers found.</CardContent></Card>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} baseParams={baseParams} />
    </div>
  );
}

/* ------------- UI bits: header / filters / pagination ------------- */

function Header() {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold">Providers</h1>
      <Link href="/providers/onboarding" className="rounded-md border px-3 py-2 text-sm">
        Become a provider
      </Link>
    </div>
  );
}

function Filters({
  q, verified, cat, skill, wilaya, minRate, maxRate, expMin, currentPage,
}: {
  q: string;
  verified: "" | "yes" | "no";
  cat: string;
  skill: string;
  wilaya: string;
  minRate: number | undefined;
  maxRate: number | undefined;
  expMin: number | undefined;
  currentPage: number;
}) {
  const baseParams: Record<string, string | undefined> = {
    q: q || undefined, verified: verified || undefined, cat: cat || undefined, skill: skill || undefined,
    wilaya: wilaya || undefined, minRate: minRate !== undefined ? String(minRate) : undefined,
    maxRate: maxRate !== undefined ? String(maxRate) : undefined, exp: expMin !== undefined ? String(expMin) : undefined,
    page: String(currentPage),
  };

  return (
    <Card>
      <CardContent className="p-4">
        <form action="/providers" method="GET" className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="flex items-center gap-2 md:col-span-2">
            <label htmlFor="q" className="w-20 text-sm text-muted-foreground">Search</label>
            <input id="q" name="q" defaultValue={q} placeholder="Provider name…" className="w-full rounded-md border px-3 py-2" />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="verified" className="w-20 text-sm text-muted-foreground">Verified</label>
            <select id="verified" name="verified" defaultValue={verified} className="w-full rounded-md border px-3 py-2 bg-white">
              <option value="">All</option>
              <option value="yes">Only verified</option>
              <option value="no">Only unverified</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="cat" className="w-20 text-sm text-muted-foreground">Category</label>
            <input id="cat" name="cat" defaultValue={cat} placeholder="slug (e.g., plumbing)" className="w-full rounded-md border px-3 py-2" />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="skill" className="w-20 text-sm text-muted-foreground">Skill</label>
            <input id="skill" name="skill" defaultValue={skill} placeholder="slug (e.g., welding)" className="w-full rounded-md border px-3 py-2" />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="wilaya" className="w-20 text-sm text-muted-foreground">Wilaya</label>
            <input id="wilaya" name="wilaya" defaultValue={wilaya} placeholder="e.g., Alger" className="w-full rounded-md border px-3 py-2" />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-20 text-sm text-muted-foreground">Rate</label>
            <div className="flex gap-2 w-full">
              <input name="minRate" defaultValue={minRate ?? ""} placeholder="min" className="w-1/2 rounded-md border px-3 py-2" />
              <input name="maxRate" defaultValue={maxRate ?? ""} placeholder="max" className="w-1/2 rounded-md border px-3 py-2" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="exp" className="w-20 text-sm text-muted-foreground">Experience</label>
            <input id="exp" name="exp" defaultValue={expMin ?? ""} placeholder="min years" className="w-full rounded-md border px-3 py-2" />
          </div>

          <div className="md:col-span-6 flex items-center gap-2 md:justify-end">
            <Link
              href={`/providers${buildQueryString(baseParams, { q: "", verified: "", cat: "", skill: "", wilaya: "", minRate: "", maxRate: "", exp: "", page: "1" })}`}
              className="rounded-md border px-3 py-2"
            >
              Reset
            </Link>
            <button type="submit" className="rounded-md bg-black px-3 py-2 text-white">Apply</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Pagination({
  page, totalPages, baseParams,
}: { page: number; totalPages: number; baseParams: Record<string, string | undefined> }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
      </div>
      <div className="flex gap-2">
        <Link
          href={page > 1 ? `/providers${buildQueryString(baseParams, { page: String(page - 1) })}` : "#"}
          aria-disabled={page <= 1}
          className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
        >
          Previous
        </Link>
        <Link
          href={page < totalPages ? `/providers${buildQueryString(baseParams, { page: String(page + 1) })}` : "#"}
          aria-disabled={page >= totalPages}
          className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
