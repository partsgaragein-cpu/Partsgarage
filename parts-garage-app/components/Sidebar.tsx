"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, Car, Wrench, FileText, Wallet, Receipt, TrendingUp, BarChart3 } from "lucide-react";

const NAV_GROUPS = [
  { label: "Operations", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/vehicles", label: "Vehicles", icon: Car },
    { href: "/parts", label: "Parts", icon: Wrench },
  ]},
  { label: "Billing", items: [
    { href: "/invoices", label: "Invoices", icon: FileText },
    { href: "/payments", label: "Payments", icon: Wallet },
  ]},
  { label: "Financials", items: [
    { href: "/expenses", label: "Expenses", icon: Receipt },
    { href: "/profit", label: "Profit & Recovery", icon: TrendingUp },
  ]},
  { label: "Insights", items: [
    { href: "/reports", label: "Reports", icon: BarChart3 },
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
        <div className="yl-row yl-items-center yl-gap-2" style={{ padding: "20px 20px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Car size={16} color="var(--bg)" strokeWidth={2.5} />
          </div>
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
                const Icon = item.icon;
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
                    <Icon size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
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
