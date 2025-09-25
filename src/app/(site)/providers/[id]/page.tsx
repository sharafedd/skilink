import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Provider = {
  user_id: string;
  display_name: string | null;
  hourly_rate: number | null;
  min_project_value: number | null;
  years_experience: number | null;
  on_site: boolean | null;
  remote: boolean | null;
  verified: boolean | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  user_id: string;
  bio: string | null;
  city: string | null;
  country: string | null;
  wilaya?: string | null;
  commune?: string | null;
  website: string | null;
  languages: string[] | null;
};

type Category = { id: string; name: string; slug: string };
type Skill = { id: string; name: string; slug: string; level?: number | null };
type PortfolioItem = { id: string; title: string; description: string | null; media_url: string | null; created_at: string };
type Review = { id: string; from_user: string; rating: number; comment: string | null; created_at: string };

function locText(p?: Profile | null) {
  if (!p) return "—";
  const parts = [p.commune ?? p.city, p.wilaya, p.country].filter(Boolean).join(", ");
  return parts || "—";
}

export default async function ProviderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerRO();
  const user_id = params.id;

  // Load provider + profile
  const [{ data: provider }, { data: profile }] = await Promise.all([
    supabase.from("provider_profiles").select("*").eq("user_id", user_id).limit(1).single(),
    supabase.from("user_profiles").select("user_id,bio,city,country,wilaya,commune,website,languages").eq("user_id", user_id).limit(1).single(),
  ]);

  const pr = provider as Provider | null;
  if (!pr) return notFound();
  const pf = profile as Profile | null;

  // Services (categories)
  const { data: svc } = await supabase
    .from("provider_services")
    .select("category_id")
    .eq("user_id", user_id);
  const catIds = new Set<string>(((svc as Array<{ category_id: string }> | null) ?? []).map((s) => s.category_id));
  let categories: Category[] = [];
  if (catIds.size) {
    const { data: cats } = await supabase.from("service_categories").select("id,name,slug").in("id", Array.from(catIds));
    categories = (cats as Category[] | null) ?? [];
  }

  // Skills (with level)
  const { data: sk } = await supabase
    .from("provider_skills")
    .select("skill_id,level")
    .eq("user_id", user_id);
  const skillIds = new Set<string>(((sk as Array<{ skill_id: string; level: number | null }> | null) ?? []).map((s) => s.skill_id));
  let skills: Skill[] = [];
  if (skillIds.size) {
    const { data: s } = await supabase.from("skills").select("id,name,slug").in("id", Array.from(skillIds));
    const levelById = new Map<string, number | null>();
    ((sk as Array<{ skill_id: string; level: number | null }> | null) ?? []).forEach((x) => levelById.set(x.skill_id, x.level));
    skills = ((s as Skill[] | null) ?? []).map((x) => ({ ...x, level: levelById.get(x.id) ?? null }));
  }

  // Portfolio (latest 6)
  const { data: port } = await supabase
    .from("provider_portfolio_items")
    .select("id,title,description,media_url,created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(6);
  const portfolio: PortfolioItem[] = (port as PortfolioItem[] | null) ?? [];

  // Reviews about this provider (latest 5)
  const { data: rv } = await supabase
    .from("reviews")
    .select("id,from_user,rating,comment,created_at,to_user")
    .eq("to_user", user_id)
    .order("created_at", { ascending: false })
    .limit(5);
  const reviews: Review[] = ((rv as Array<Review & { to_user: string }> | null) ?? []).map((r) => ({
    id: r.id, from_user: r.from_user, rating: r.rating, comment: r.comment, created_at: r.created_at,
  }));
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <section className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{pr.display_name ?? "Provider"}</h1>
          {pr.verified ? <Badge>Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
          {avgRating ? <Badge variant="outline">★ {avgRating}</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div><span className="text-muted-foreground">Rate:&nbsp;</span>{pr.hourly_rate != null ? `${pr.hourly_rate} DZD/h` : "—"}</div>
          <div><span className="text-muted-foreground">Min project:&nbsp;</span>{pr.min_project_value != null ? `${pr.min_project_value} DZD` : "—"}</div>
          <div><span className="text-muted-foreground">Experience:&nbsp;</span>{pr.years_experience != null ? `${pr.years_experience} yrs` : "—"}</div>
          <div><span className="text-muted-foreground">Location:&nbsp;</span>{locText(pf)}</div>
        </div>
        <div className="flex gap-2">
          <Link href={`/providers/${encodeURIComponent(pr.user_id)}/invite`} className="rounded-md bg-black px-4 py-2 text-white">Invite to project</Link>
          <Link href={`/messages?to=${pr.user_id}`} className="rounded-md border px-4 py-2">Contact</Link>
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="text-xl font-semibold mb-2">About</h2>
        <Card>
          <CardContent className="p-4">
            <p className="whitespace-pre-wrap">{pf?.bio ?? "No bio yet."}</p>
            {pf?.website ? (
              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">Website:&nbsp;</span>
                <a href={pf.website} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">{pf.website}</a>
              </p>
            ) : null}
            {pf?.languages?.length ? (
              <p className="mt-2 text-sm text-muted-foreground">Languages: {pf.languages.join(", ")}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Services & Skills */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-3">Services</h3>
            <div className="flex flex-wrap gap-2">
              {categories.length ? categories.map((c) => (
                <Link key={c.id} href={`/providers?cat=${c.slug}`} className="hover:opacity-80">
                  <Badge variant="outline">{c.name}</Badge>
                </Link>
              )) : <span className="text-muted-foreground text-sm">No services listed.</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-3">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {skills.length ? skills.map((s) => (
                <Link key={s.id} href={`/providers?skill=${s.slug}`} className="hover:opacity-80">
                  <Badge>{s.name}{s.level ? ` · L${s.level}` : ""}</Badge>
                </Link>
              )) : <span className="text-muted-foreground text-sm">No skills listed.</span>}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Portfolio */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Portfolio</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {portfolio.length ? portfolio.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{item.title}</h4>
                  <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
                {item.media_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.media_url} alt={item.title} className="w-full rounded-md object-cover max-h-64" />
                ) : null}
                <p className="text-sm text-muted-foreground">{item.description ?? ""}</p>
              </CardContent>
            </Card>
          )) : (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No portfolio items yet.</CardContent></Card>
          )}
        </div>
      </section>

      {/* Reviews */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Reviews</h2>
        <div className="space-y-3">
          {reviews.length ? reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">★ {r.rating}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-2 text-sm">{r.comment ?? ""}</p>
              </CardContent>
            </Card>
          )) : (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No reviews yet.</CardContent></Card>
          )}
        </div>
      </section>
    </div>
  );
}
