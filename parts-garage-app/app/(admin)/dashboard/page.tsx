import { createClient } from "@/lib/supabase/server";
import { inr } from "@/lib/types";
import { PlateBadge, StatusBadge } from "@/components/Badges";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ data: vehicles }, { data: parts }, { data: expenses }, { data: invoices }] = await Promise.all([
    supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
    supabase.from("parts").select("*").eq("archived", false),
    supabase.from("expenses").select("*"),
    supabase.from("invoices").select("id, amount_received, invoice_items(taxable_value, qty, gst_percent)"),
  ]);

  const v = vehicles || [];
  const p = parts || [];
  const e = expenses || [];
  const inv = invoices || [];

  const totalMedia = 0; // media count fetched per-vehicle when needed; kept out of dashboard query for speed
  const totalRevenue = p.filter((x) => x.status === "Sold").reduce((s, x) => s + (x.actual_price || 0), 0);
  const totalInvestment = e.reduce((s, x) => s + x.amount, 0);
  const net = totalRevenue - totalInvestment;
  const inventoryValue = p.filter((x) => x.status !== "Sold" && x.status !== "Scrap").reduce((s, x) => s + x.expected_price, 0);

  const pendingPayments = inv.reduce((s: number, i: any) => {
    const subtotal = i.invoice_items.reduce((a: number, it: any) => a + it.taxable_value * it.qty, 0);
    const gst = i.invoice_items.reduce((a: number, it: any) => a + (it.taxable_value * it.qty * it.gst_percent) / 100, 0);
    const due = Math.max(subtotal + gst - i.amount_received, 0);
    return s + due;
  }, 0);

  const perVehicle = v.map((vh) => ({
    investment: e.filter((x) => x.vehicle_id === vh.id).reduce((s, x) => s + x.amount, 0),
    revenue: p.filter((x) => x.vehicle_id === vh.id && x.status === "Sold").reduce((s, x) => s + (x.actual_price || 0), 0),
  }));
  const belowRecovery = perVehicle.filter((r) => r.investment > r.revenue).length;
  const profitable = perVehicle.filter((r) => r.revenue > r.investment).length;

  const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="yl-card" style={{ padding: "16px 18px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 12 }}>{label}</div>
      <div className="yl-display yl-fw-600" style={{ fontSize: 24, color: "var(--text)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div className="yl-topbar">
        <h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Dashboard</h1>
        <Link href="/vehicles/new" className="yl-btn-primary">+ Register New Car</Link>
      </div>
      <div className="yl-page">
        <div className="yl-grid-4" style={{ marginBottom: 12 }}>
          <Stat label="Total Vehicles" value={v.length} />
          <Stat label="Parts Tracked" value={p.length} sub={`${p.filter((x) => x.status === "Available").length} available now`} />
          <Stat label="Net Position" value={inr(net)} sub="Revenue recovered − total spend" />
          <Stat label="Inventory Value" value={inr(inventoryValue)} sub="Unsold parts, expected price" />
        </div>
        <div className="yl-grid-4" style={{ marginBottom: 24 }}>
          <Stat label="Below Recovery" value={belowRecovery} sub="Vehicles yet to break even" />
          <Stat label="Profitable Vehicles" value={profitable} />
          <Stat label="Pending Payments" value={inr(pendingPayments)} />
          <Stat label="Total Investment" value={inr(totalInvestment)} />
        </div>

        <h2 className="yl-section-label" style={{ marginBottom: 12 }}>Recently Added</h2>
        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th>Registration</th><th>Vehicle</th><th>Status</th><th>Added</th></tr></thead>
            <tbody>
              {v.slice(0, 5).map((vh) => (
                <tr key={vh.id} className="yl-tr">
                  <td><Link href={`/vehicles/${vh.registration_number}`} style={{ textDecoration: "none" }}><PlateBadge reg={vh.registration_number} /></Link></td>
                  <td style={{ color: "var(--text)" }}>{vh.car_name}</td>
                  <td><StatusBadge status={vh.status} /></td>
                  <td style={{ color: "var(--text-faint)", fontSize: 12 }}>{new Date(vh.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {v.length === 0 && <tr><td colSpan={4} className="yl-empty">No vehicles yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
