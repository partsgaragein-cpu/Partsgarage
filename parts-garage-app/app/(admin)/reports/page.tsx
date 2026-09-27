import { createClient } from "@/lib/supabase/server";
import { VehicleCell } from "@/components/Badges";
import { inr, isPriorityPart } from "@/lib/types";
import VerificationChecklist from "@/components/VerificationChecklist";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function ReportsPage() {
  const supabase = createClient();

  const [{ data: parts }, { data: vehicles }, { data: profitRows }, { data: invoiceItems }] = await Promise.all([
    supabase.from("parts").select("*, vehicles(registration_number)").eq("archived", false),
    supabase.from("vehicles").select("*"),
    supabase.from("vehicle_profit").select("*"),
    supabase.from("invoice_items").select("category"),
  ]);

  const p = parts || [];
  const v = vehicles || [];
  const profit = profitRows || [];
  const now = Date.now();

  const soldCount = p.filter((x) => x.status === "Sold").length;
  const revenue = p.filter((x) => x.status === "Sold").reduce((s, x) => s + (x.actual_price || 0), 0);
  const partsAddedThisWeek = p.filter((x) => now - new Date(x.created_at).getTime() < WEEK_MS).length;

  const categoryCounts = new Map<string, number>();
  (invoiceItems || []).forEach((it: any) => {
    if (!it.category) return;
    categoryCounts.set(it.category, (categoryCounts.get(it.category) || 0) + 1);
  });
  let bestCategory: string | null = null;
  let bestCount = 0;
  categoryCounts.forEach((count, cat) => {
    if (count > bestCount) { bestCount = count; bestCategory = cat; }
  });

  const slowMoving = p.filter((x) => x.status === "Available");

  // Flag 1: vehicles still below recovery, added more than a week ago
  const flaggedVehicles = profit
    .filter((r) => r.total_investment > r.total_revenue_recovered)
    .map((r) => {
      const vh = v.find((x) => x.id === r.id);
      return vh && now - new Date(vh.created_at).getTime() > WEEK_MS ? { vh, r } : null;
    })
    .filter((x): x is { vh: any; r: any } => x !== null);

  // Flag 2: parts still Available, added more than a week ago
  const flaggedParts = p.filter((x) => x.status === "Available" && now - new Date(x.created_at).getTime() > WEEK_MS);

  const hasFlags = flaggedVehicles.length > 0 || flaggedParts.length > 0;

  const verificationRows = p
    .filter((x) => x.status !== "Sold" && x.status !== "Scrap" && (x.expected_price >= 8000 || isPriorityPart(x.name, x.category)))
    .map((x: any) => ({
      id: x.id, name: x.name, storage_location: x.storage_location, expected_price: x.expected_price,
      priority: isPriorityPart(x.name, x.category), reg: x.vehicles?.registration_number || null,
    }));

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)" }}>Reports</h1></div>
      <div className="yl-page">
        <div className="yl-grid-4" style={{ marginBottom: 24 }}>
          <div className="yl-card" style={{ padding: 16 }}><div className="yl-mini-label">Parts Sold</div><div className="yl-display yl-fw-600" style={{ fontSize: 22, color: "var(--text)" }}>{soldCount}</div></div>
          <div className="yl-card" style={{ padding: 16 }}><div className="yl-mini-label">Revenue</div><div className="yl-display yl-fw-600" style={{ fontSize: 22, color: "var(--whatsapp)" }}>{inr(revenue)}</div></div>
          <div className="yl-card" style={{ padding: 16 }}><div className="yl-mini-label">Parts Added (7d)</div><div className="yl-display yl-fw-600" style={{ fontSize: 22, color: "var(--text)" }}>{partsAddedThisWeek}</div></div>
          <div className="yl-card" style={{ padding: 16 }}>
            <div className="yl-mini-label">Best-Selling Category</div>
            <div className="yl-display yl-fw-600" style={{ fontSize: 17, color: "var(--text)" }}>{bestCategory || "—"}</div>
            {bestCategory && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{bestCount} sold</div>}
          </div>
        </div>

        {hasFlags && (
          <>
            <h2 className="yl-section-label" style={{ marginBottom: 12 }}>Flagged for Attention</h2>
            <div className="yl-card" style={{ padding: "6px 0", marginBottom: 24 }}>
              {flaggedVehicles.map(({ vh, r }) => (
                <div key={vh.id} className="yl-row yl-items-center yl-gap-2" style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "#F97316" }}>⚠️</span>
                  <span style={{ fontSize: 13, color: "var(--text)" }}>
                    <strong>{vh.registration_number}</strong> — investment not yet recovered, added {new Date(vh.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {flaggedParts.map((x: any) => (
                <div key={x.id} className="yl-row yl-items-center yl-gap-2" style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "#F97316" }}>⚠️</span>
                  <span style={{ fontSize: 13, color: "var(--text)" }}>
                    <strong>{x.name}</strong> — unsold since {new Date(x.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="yl-section-label" style={{ marginBottom: 12 }}>Slow-Moving Inventory</h2>
        <div className="yl-card yl-table-wrap" style={{ marginBottom: 24 }}>
          <table className="yl-table">
            <thead><tr><th>Part</th><th>Vehicle</th><th>Category</th><th>Expected Price</th></tr></thead>
            <tbody>
              {slowMoving.map((x: any) => (
                <tr key={x.id} className="yl-tr" style={{ cursor: "default" }}>
                  <td style={{ color: "var(--text)" }}>{x.name}</td>
                  <td><VehicleCell reg={x.vehicles?.registration_number || null} /></td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{x.category}</td>
                  <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{inr(x.expected_price)}</td>
                </tr>
              ))}
              {slowMoving.length === 0 && <tr><td colSpan={4} className="yl-empty">Nothing sitting idle right now.</td></tr>}
            </tbody>
          </table>
        </div>

        <h2 className="yl-section-label" style={{ marginBottom: 4 }}>Physical Stock Verification</h2>
        <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 12 }}>High-value parts (₹8,000+) and priority categories — tap a row as you confirm it in the yard.</div>
        <VerificationChecklist rows={verificationRows} />
      </div>
    </div>
  );
}
