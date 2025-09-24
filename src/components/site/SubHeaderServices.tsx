// src/components/site/SubHeaderServices.tsx
"use client";

const SERVICES = [
  "Home Cleaning","Plumbing","Garden Care","Handyman Repairs","Painting",
  "Electrical Services","Personal Chef & Catering","Tutoring","Moving & Delivery",
  "IT Support","Web Development","Graphic Design","Photography","Event Planning",
  "Pet Care","Carpentry","Roofing","Appliance Repair","Makeup & Hair","Language Lessons",
];

type CSSVars = React.CSSProperties & { ["--duration"]?: string; ["--gap"]?: string };
import * as React from "react";

export default function SubHeaderServicesFull() {
  const vars: CSSVars = {
    "--duration": "28s",        // speed
    "--gap": "3.5rem",
    backgroundColor: "#eef2cc", // bar color
    borderColor: "#d7dfb1",
    color: "#656d65",
  };

  return (
    <div className="border-y w-full" style={vars}>
      {/* full-bleed, with our own padding instead of <Container> */}
      <div className="relative overflow-hidden py-2 px-4 sm:px-6 lg:px-8">
        <div className="marquee-fade" />
        {/* Moving strip: two copies side-by-side */}
        <div className="animate-marquee flex w-max gap-[var(--gap)]">
          <ul className="flex gap-[var(--gap)] min-w-max text-sm sm:text-base font-medium">
            {SERVICES.map((s) => (
              <li key={`a-${s}`} className="whitespace-nowrap">{s}</li>
            ))}
          </ul>
          <ul
            className="flex gap-[var(--gap)] min-w-max text-sm sm:text-base font-medium"
            aria-hidden="true"
          >
            {SERVICES.map((s) => (
              <li key={`b-${s}`} className="whitespace-nowrap">{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
