"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// A table row that opens `href` when clicked anywhere on it — not just on one
// link inside it. Clicks on real links/buttons inside the row still do their own thing.
export default function RowLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className="yl-tr"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
