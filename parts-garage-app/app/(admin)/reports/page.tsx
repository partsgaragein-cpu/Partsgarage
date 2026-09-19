import { createClient } from "@/lib/supabase/server";
import { VehicleCell } from "@/components/Badges";
import { inr } from "@/lib/types";

export const dynamic = "force-dynamic";

const PRIORITY_KEYWORDS = ["engine", "gearbox", "ecu", "turbo", "injector", "catalytic", "headlight", "steering rack", "alloy wheel"];
const isPriority = (name: string, category: string) => PRIORITY_KEYWORDS.some((k) => name.toLowerCase().includes(k) || category.toLowerCase().includes(k));

export default async function ReportsPage() {
  const supabase = createClient();
  const { data: parts } = await supabase.from("parts").select("*, vehicles(registration_number)").eq("archived", false);
  const p = parts || [];

  const soldCount = p.filter((x) => x.status === "Sold").length;
  const revenue = p.filter((x) => x.status === "Sold").reduce((s, x) => s + (x.actual_price || 0), 0);
  const slowMoving = p.filter((x) => x.status === "Available");
  const verificationList = p.filter((x) => x.status !== "Sold" && x.status !== "Scrap" && (x.expected_price >= 8000 || isPriority(x.name, x.category)));

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Reports</h1></div>
      <div className="yl-page">
        <div className="yl-grid-3" style={{ marginBottom: 24 }}>
          <div className="yl-card" style={{ padding: 16 }}><div className="yl-mini-label">Parts Sold</div><div className="yl-display yl-fw-600" style={{ fontSize: 22, color: "var(--text)" }}>{soldCount}</div></div>
          <div className="yl-card" style={{ padding: 16 }}><div className="yl-mini-label">Revenue</div><div className="yl-display yl-fw-600" style={{ fontSize: 22, color: "var(--whatsapp)" }}>{inr(revenue)}</div></div>
          <div className="yl-card" style={{ padding: 16 }}><div className="yl-mini-label">Slow-Moving Stock</div><div className="yl-display yl-fw-600" style={{ fontSize: 22, color: "var(--text)" }}>{slowMoving.length}</div></div>
        </div>

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
        <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 12 }}>High-value parts (₹8,000+) and priority categories.</div>
        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th>Part</th><th>Location</th><th>Vehicle</th><th>Expected Price</th></tr></thead>
            <tbody>
              {verificationList.map((x: any) => (
                <tr key={x.id} className="yl-tr" style={{ cursor: "default" }}>
                  <td style={{ color: "var(--text)" }}>{x.name}</td>
                  <td style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{x.storage_location}</td>
                  <td><VehicleCell reg={x.vehicles?.registration_number || null} /></td>
                  <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{inr(x.expected_price)}</td>
                </tr>
              ))}
              {verificationList.length === 0 && <tr><td colSpan={4} className="yl-empty">No high-value or priority parts pending verification.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
