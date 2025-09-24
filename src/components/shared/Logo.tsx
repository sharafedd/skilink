import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";

type LogoSize = "sm" | "md" | "lg" | "xl";
type LogoProps = {
  /** Quick preset sizes (overridden by `heightPx` if provided) */
  size?: LogoSize;
  /** Exact pixel height if you want a specific value */
  heightPx?: number;
  /** Optional extra classes */
  className?: string;
  alt?: string;
};

const sizeClass: Record<LogoSize, string> = {
  sm: "h-8",            // 32px
  md: "h-12",           // 48px
  lg: "h-14",           // 56px
  xl: "h-16 md:h-20",   // 64px mobile, 80px md+
};

export default function Logo({
  size = "lg",
  heightPx,
  className,
  alt = "Skilink",
}: LogoProps) {
  // If heightPx provided, use inline style to strictly lock the height.
  const style: CSSProperties | undefined = heightPx
    ? { height: heightPx, width: "auto" }
    : undefined;

  return (
    <Link href="/" aria-label="Skilink home" className="inline-flex items-center">
      <Image
        src="/skilink.png"
        alt={alt}
        width={2400}
        height={600}
        priority
        draggable={false}
        sizes="(max-width: 768px) 160px, 240px"
        className={[
          "w-auto",
          heightPx ? "" : sizeClass[size], // use preset class if no explicit height
          className ?? "",
        ].join(" ").trim()}
        style={style}
      />
    </Link>
  );
}
