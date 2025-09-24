"use client";

function hashToHsl(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return `hsl(${h} 45% 40%)`;
}

export default function UserAvatar({
  name = "Skilink",
  size = 36,
}: {
  name?: string;           // ← was `string`
  size?: number;
}) {
  const safe = name?.trim() || "Skilink";
  const initial = safe[0]!.toUpperCase();
  const bg = hashToHsl(safe);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: bg,
    color: "white",
    display: "grid",
    placeItems: "center",
    borderRadius: "9999px",
    fontWeight: 700,
    letterSpacing: 0.3,
  };
  return <div aria-label={`${safe} avatar`} style={style}>{initial}</div>;
}
