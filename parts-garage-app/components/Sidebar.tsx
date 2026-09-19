"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_GROUPS = [
  { label: "Operations", items: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/vehicles", label: "Vehicles" },
    { href: "/parts", label: "Parts" },
  ]},
  { label: "Billing", items: [
    { href: "/invoices", label: "Invoices" },
    { href: "/payments", label: "Payments" },
  ]},
  { label: "Financials", items: [
    { href: "/expenses", label: "Expenses" },
    { href: "/profit", label: "Profit & Recovery" },
  ]},
  { label: "Insights", items: [
    { href: "/reports", label: "Reports" },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="yl-icon-btn yl-mobile-only no-print"
        style={{ position: "fixed", top: 14, left: 14, zIndex: 60, background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        ☰
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 75 }}
          className="yl-mobile-only"
        />
      )}
      <div className={`yl-sidebar no-print${open ? " open" : ""}`}>
        <div style={{ padding: "20px 20px 18px", borderBottom: "1px solid var(--border)" }}>
          <span className="yl-display yl-fw-600" style={{ fontSize: 16, color: "var(--text)" }}>Parts Garage</span>
        </div>
        <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-faint)", textTransform: "uppercase", padding: "0 10px 8px" }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="yl-row yl-items-center yl-gap-2"
                    style={{
                      padding: "9px 10px", borderRadius: 7, marginBottom: 2, fontSize: 13.5,
                      fontWeight: isActive ? 600 : 500, textDecoration: "none",
                      background: isActive ? "var(--accent-soft)" : "transparent",
                      color: isActive ? "var(--accent)" : "var(--text-muted)",
                      borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
          <button onClick={handleLogout} className="yl-link-btn">Log out</button>
        </div>
      </div>
    </>
  );
}
