import Link from "next/link";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="inline-block h-6 w-6 rounded-lg bg-brand-600" />
      {!compact && <span>Skilink</span>}
    </Link>
  );
}
