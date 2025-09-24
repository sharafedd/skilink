import "@/styles/globals.css";
import SiteHeader from "@/components/site/Header";
import SubHeaderServices from "@/components/site/SubHeaderServices";
import SiteFooter from "@/components/site/Footer";

export const metadata = {
  title: "Skilink — Find talent, get things done",
  description: "A marketplace where tasks meet talent.",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader />
      <SubHeaderServices />
      <main className="flex-1">
        {/* subtle gradient like your mock */}
        <div className="bg-gradient-to-b from-brand-100/40 to-brand-50">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
