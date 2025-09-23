import { cn } from "@/lib/utils";

export default function Container({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}
