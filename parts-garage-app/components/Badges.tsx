const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Available: { bg: "rgba(242,169,0,0.12)", color: "var(--accent)" },
  Reserved: { bg: "rgba(96,165,250,0.12)", color: "#60A5FA" },
  Sold: { bg: "rgba(37,211,102,0.12)", color: "var(--whatsapp)" },
  Scrap: { bg: "rgba(229,72,77,0.12)", color: "#E5484D" },
  "Under Testing": { bg: "rgba(154,161,170,0.14)", color: "var(--text-muted)" },
  Returned: { bg: "rgba(249,115,22,0.12)", color: "#F97316" },
  "In dismantling": { bg: "rgba(96,165,250,0.12)", color: "#60A5FA" },
  "Inventory complete": { bg: "rgba(242,169,0,0.12)", color: "var(--accent)" },
  "Fully sold": { bg: "rgba(37,211,102,0.12)", color: "var(--whatsapp)" },
  Closed: { bg: "rgba(154,161,170,0.14)", color: "var(--text-muted)" },
  Paid: { bg: "rgba(37,211,102,0.12)", color: "var(--whatsapp)" },
  "Partially Paid": { bg: "rgba(242,169,0,0.12)", color: "var(--accent)" },
  Unpaid: { bg: "rgba(229,72,77,0.12)", color: "#E5484D" },
};

export function PlateBadge({ reg, size = "sm" }: { reg: string; size?: "sm" | "lg" }) {
  const dims = size === "lg" ? { fontSize: 22, padding: "11px 18px" } : { fontSize: 12, padding: "4px 10px" };
  return (
    <span
      className="yl-mono yl-fw-700"
      style={{
        display: "inline-flex", alignItems: "center", background: "var(--accent)", color: "var(--bg)",
        border: "2px solid var(--bg)", borderRadius: 4, letterSpacing: size === "lg" ? "0.14em" : "0.05em", ...dims,
      }}
    >
      {reg}
    </span>
  );
}

export function VehicleCell({ reg }: { reg: string | null }) {
  if (!reg) {
    return (
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", background: "var(--surface-2)", padding: "3px 9px", borderRadius: 100, display: "inline-block" }}>
        Standalone
      </span>
    );
  }
  return <PlateBadge reg={reg} />;
}

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: "var(--surface-2)", color: "var(--text-muted)" };
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 100, background: c.bg, color: c.color, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}
