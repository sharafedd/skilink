// src/app/(site)/pricing/page.tsx
import Link from "next/link";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SearchParams = {
  billing?: "monthly" | "yearly" | "";
};

const CURRENCY = "DZD";

type Plan = {
  id: "free" | "pro" | "business";
  name: string;
  tagline: string;
  monthly: number; // price per month in DZD
  yearly: number;  // price per year in DZD (discounted)
  feePct: number;  // marketplace fee percentage on transactions
  features: string[];
  ctaHref: string;
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Get started & list your services",
    monthly: 0,
    yearly: 0,
    feePct: 12,
    features: [
      "Public profile & portfolio",
      "Up to 3 active proposals",
      "Standard support",
      "Escrow payments",
    ],
    ctaHref: "/signup",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For active professionals",
    monthly: 3500,
    yearly: 3500 * 10, // ~2 months free
    feePct: 8,
    features: [
      "Unlimited proposals",
      "Verified badge eligibility",
      "Priority in search",
      "Invoicing & receipts",
      "Basic dispute assistance",
    ],
    ctaHref: "/billing/subscribe?plan=pro",
    highlight: true,
  },
  {
    id: "business",
    name: "Business",
    tagline: "Teams & agencies at scale",
    monthly: 12000,
    yearly: 12000 * 10, // ~2 months free
    feePct: 5,
    features: [
      "Team seats & roles",
      "Account manager",
      "Custom onboarding",
      "Lower marketplace fees",
      "Priority dispute handling",
    ],
    ctaHref: "/contact?topic=enterprise",
  },
];

function money(amount: number) {
  if (amount === 0) return "Free";
  // Keep it simple/local without Intl for consistency
  return `${amount.toLocaleString()} ${CURRENCY}`;
}

function PlanCard({
  plan,
  billing,
}: {
  plan: Plan;
  billing: "monthly" | "yearly";
}) {
  const price = billing === "yearly" ? plan.yearly : plan.monthly;
  const subLabel =
    billing === "yearly"
      ? price === 0
        ? "per year"
        : "per year (≈2 months free)"
      : price === 0
      ? "per month"
      : "per month";

  return (
    <Card className={plan.highlight ? "ring-2 ring-black" : ""}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">{plan.name}</h3>
            <p className="text-sm text-muted-foreground">{plan.tagline}</p>
          </div>
          {plan.highlight ? <Badge>Most popular</Badge> : null}
        </div>

        <div>
          <div className="text-3xl font-bold">{money(price)}</div>
          <div className="text-xs text-muted-foreground">{subLabel}</div>
        </div>

        <div className="text-sm">
          <span className="font-medium">{plan.feePct}%</span>{" "}
          marketplace fee on successful payments
        </div>

        <ul className="space-y-2 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-black inline-block" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="pt-2">
          <Link
            href={plan.ctaHref}
            className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm ${
              plan.highlight
                ? "bg-black text-white"
                : "border"
            }`}
          >
            {plan.id === "business" ? "Talk to sales" : "Choose plan"}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createSupabaseServerRO();

  // Decide billing period from URL (?billing=monthly|yearly), default monthly
  const billing: "monthly" | "yearly" =
    (searchParams?.billing === "yearly" ? "yearly" : "monthly");

  // Pull some live stats to make the page feel “real”
  const [provRes, projRes, catRes] = await Promise.all([
    supabase.from("provider_profiles").select("user_id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("service_categories").select("id", { count: "exact", head: true }),
  ]);
  const providersCount = provRes.count ?? 0;
  const openProjectsCount = projRes.count ?? 0;
  const categoriesCount = catRes.count ?? 0;

  const baseParams: Record<string, string | undefined> = {
    billing,
  };

  const qs = (b: "monthly" | "yearly") => {
    const p = new URLSearchParams({ ...baseParams, billing: b });
    return `/pricing?${p.toString()}`;
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Hero */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Simple pricing for Skilink</h1>
            <p className="mt-2 text-muted-foreground">
              Transparent plans in {CURRENCY}. Upgrade anytime.
            </p>
          </div>
          <div className="inline-flex rounded-md border p-1">
            <Link
              href={qs("monthly")}
              className={`px-3 py-1.5 text-sm rounded-md ${
                billing === "monthly" ? "bg-black text-white" : ""
              }`}
            >
              Monthly
            </Link>
            <Link
              href={qs("yearly")}
              className={`px-3 py-1.5 text-sm rounded-md ${
                billing === "yearly" ? "bg-black text-white" : ""
              }`}
            >
              Yearly
            </Link>
          </div>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-semibold">{providersCount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">providers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-semibold">{openProjectsCount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">open projects</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-semibold">{categoriesCount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">service categories</div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Plans */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} billing={billing} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Prices shown in {CURRENCY}. Taxes may apply. Marketplace fee is charged only on successful payments.
        </p>
      </section>

      {/* Comparison */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Compare features</h2>
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Free</TableHead>
                  <TableHead>Pro</TableHead>
                  <TableHead>Business</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Marketplace fee</TableCell>
                  <TableCell>12%</TableCell>
                  <TableCell>8%</TableCell>
                  <TableCell>5%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Active proposals</TableCell>
                  <TableCell>3</TableCell>
                  <TableCell>Unlimited</TableCell>
                  <TableCell>Unlimited</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Search ranking boost</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>✓</TableCell>
                  <TableCell>✓</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Verified badge eligibility</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>✓</TableCell>
                  <TableCell>✓</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Team seats</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>✓</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Support</TableCell>
                  <TableCell>Standard</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Account manager</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* FAQ (no extra UI deps) */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">FAQ</h2>
        <details className="rounded-md border px-4 py-3">
          <summary className="cursor-pointer font-medium">Can I switch plans later?</summary>
          <p className="mt-2 text-sm text-muted-foreground">Yes, you can upgrade or downgrade anytime. Changes apply to the next billing cycle.</p>
        </details>
        <details className="rounded-md border px-4 py-3">
          <summary className="cursor-pointer font-medium">How are fees charged?</summary>
          <p className="mt-2 text-sm text-muted-foreground">The marketplace fee is taken from each successful payment. Subscription fees are billed separately.</p>
        </details>
        <details className="rounded-md border px-4 py-3">
          <summary className="cursor-pointer font-medium">What currency do you support?</summary>
          <p className="mt-2 text-sm text-muted-foreground">All prices are shown and billed in {CURRENCY}. Multi-currency support is planned.</p>
        </details>
      </section>

      {/* CTA */}
      <section className="flex flex-wrap gap-3 items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Not sure which plan fits? Start with <span className="font-medium">Free</span> — upgrade when you’re ready.
        </div>
        <div className="flex gap-2">
          <Link href="/signup" className="rounded-md border px-4 py-2">Start free</Link>
          <Link href="/billing/subscribe?plan=pro" className="rounded-md bg-black px-4 py-2 text-white">Go Pro</Link>
        </div>
      </section>
    </div>
  );
}
