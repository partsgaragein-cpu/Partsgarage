import { createClient } from "@/lib/supabase/server";
import { PlateBadge } from "@/components/Badges";
import { inr } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfitPage() {
  const supabase = createClient();
  const { data: rows } = await supabase.from("vehicle_profit").select("*").order("registration_number");

  const totalInv = (rows || []).reduce((s, r) => s + r.total_investment, 0);
  const totalRev = (rows || []).reduce((s, r) => s + r.total_revenue_recovered, 0);

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Profit & Recovery</h1></div>
      <div className="yl-page">
        <div className="yl-grid-3" style={{ marginBottom: 20 }}>
          <div className="yl-card" style={{ padding: 16 }}><div className="yl-mini-label">Total Investment</div><div className="yl-display yl-fw-600" style={{ fontSize: 22, color: "var(--text)" }}>{inr(totalInv)}</div></div>
          <div className="yl-card" style={{ padding: 16 }}><div className="yl-mini-label">Total Revenue Recovered</div><div className="yl-display yl-fw-600" style={{ fontSize: 22, color: "var(--text)" }}>{inr(totalRev)}</div></div>
          <div className="yl-card" style={{ padding: 16 }}><div className="yl-mini-label">Net Gross Profit</div><div className="yl-display yl-fw-600" style={{ fontSize: 22, color: totalRev - totalInv >= 0 ? "var(--whatsapp)" : "#E5484D" }}>{inr(totalRev - totalInv)}</div></div>
        </div>
        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th>Vehicle</th><th>Investment</th><th>Revenue Recovered</th><th>Remaining Recovery</th><th>Gross Profit/Loss</th></tr></thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.id} className="yl-tr" style={{ cursor: "default" }}>
                  <td><PlateBadge reg={r.registration_number} /><div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>{r.car_name}</div></td>
                  <td style={{ color: "var(--text)" }}>{inr(r.total_investment)}</td>
                  <td style={{ color: "var(--text)" }}>{inr(r.total_revenue_recovered)}</td>
                  <td style={{ color: "var(--text-muted)" }}>{r.remaining_recovery > 0 ? inr(r.remaining_recovery) : "Fully recovered"}</td>
                  <td style={{ fontWeight: 600, color: r.gross_profit >= 0 ? "var(--whatsapp)" : "#E5484D" }}>{r.gross_profit >= 0 ? "+" : ""}{inr(r.gross_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
