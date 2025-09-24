import Link from "next/link";
import Image from "next/image";

export default function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 shrink-0" aria-label="Skilink home">
    <Image
        src="/skilink.png"
        alt="Skilink"
        width={1200}    
        height={300}
        priority
        className="h-14 w-auto md:h-16 lg:h-20 max-h-none"
    />
    </Link>
  );
}