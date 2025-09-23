import Container from "@/components/shared/Container";
import Logo from "@/components/shared/Logo";

export default function AdminHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
      <Container className="flex h-14 items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="rounded bg-accent-100 px-2 py-1 text-xs font-medium text-accent-700">Admin</span>
        </div>
      </Container>
    </header>
  );
}
