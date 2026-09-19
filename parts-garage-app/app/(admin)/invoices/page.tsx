import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/Badges";
import { inr } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

function totals(inv: any) {
  const subtotal = inv.invoice_items.reduce((s: number, it: any) => s + it.taxable_value * it.qty, 0);
  const gst = inv.invoice_items.reduce((s: number, it: any) => s + (it.taxable_value * it.qty * it.gst_percent) / 100, 0);
  const grandTotal = subtotal + gst;
  const due = Math.max(grandTotal - inv.amount_received, 0);
  const status = due <= 0 ? "Paid" : inv.amount_received > 0 ? "Partially Paid" : "Unpaid";
  return { grandTotal, due, status };
}

export default async function InvoicesPage() {
  const supabase = createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .order("invoice_date", { ascending: false });

  return (
    <div>
      <div className="yl-topbar">
        <h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Invoices</h1>
        <Link href="/invoices/new" className="yl-btn-primary">+ New Invoice</Link>
      </div>
      <div className="yl-page">
        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th>Invoice No.</th><th>Date</th><th>Buyer</th><th>Items</th><th>Grand Total</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {(invoices || []).map((inv: any) => {
                const t = totals(inv);
                return (
                  <tr key={inv.id} className="yl-tr" style={{ cursor: "default" }}>
                    <td className="yl-mono" style={{ fontSize: 12.5, color: "var(--text)" }}><Link href={`/invoices/${inv.id}`} style={{ color: "inherit", textDecoration: "none" }}>{inv.invoice_no}</Link></td>
                    <td style={{ fontSize: 12, color: "var(--text-faint)" }}>{inv.invoice_date}</td>
                    <td style={{ color: "var(--text)" }}>{inv.buyer_name}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{inv.invoice_items.length}</td>
                    <td style={{ color: "var(--text)", fontWeight: 500 }}>{inr(t.grandTotal)}</td>
                    <td style={{ color: t.due > 0 ? "#E5484D" : "var(--text-faint)" }}>{t.due > 0 ? inr(t.due) : "—"}</td>
                    <td><StatusBadge status={t.status} /></td>
                  </tr>
                );
              })}
              {(!invoices || invoices.length === 0) && <tr><td colSpan={7} className="yl-empty">No invoices yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
