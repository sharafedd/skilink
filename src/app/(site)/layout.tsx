import "@/styles/globals.css";
import SiteFooter from "@/components/site/Footer";
import SiteHeader from "@/components/site/Header";
import SubHeaderServices from "@/components/site/SubHeaderServices";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Skilink — Find talent, get things done", description: "…" };

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader user={user} />
      <SubHeaderServices />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-brand-100/40 to-brand-50">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
