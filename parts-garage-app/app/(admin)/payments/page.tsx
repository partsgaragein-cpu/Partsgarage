"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inr } from "@/lib/types";

export default function PaymentsPage() {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const load = async () => {
    const { data } = await supabase.from("invoices").select("*, invoice_items(*)").order("invoice_date", { ascending: false });
    setInvoices(data || []);
  };
  useEffect(() => { load(); }, []);

  const withTotals = invoices.map((inv) => {
    const subtotal = inv.invoice_items.reduce((s: number, it: any) => s + it.taxable_value * it.qty, 0);
    const gst = inv.invoice_items.reduce((s: number, it: any) => s + (it.taxable_value * it.qty * it.gst_percent) / 100, 0);
    const grandTotal = subtotal + gst;
    return { inv, grandTotal, due: Math.max(grandTotal - inv.amount_received, 0) };
  });
  const pending = withTotals.filter((x) => x.due > 0);
  const totalDue = pending.reduce((s, x) => s + x.due, 0);

  const recordPayment = async (inv: any, grandTotal: number) => {
    const newReceived = Math.min(inv.amount_received + (Number(amount) || 0), grandTotal);
    await supabase.from("invoices").update({ amount_received: newReceived }).eq("id", inv.id);
    setPayingId(null); setAmount("");
    load();
  };

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Payments — {inr(totalDue)} outstanding</h1></div>
      <div className="yl-page">
        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th>Invoice No.</th><th>Buyer</th><th>Grand Total</th><th>Received</th><th>Due</th><th></th></tr></thead>
            <tbody>
              {pending.map(({ inv, grandTotal, due }) => (
                <>
                  <tr key={inv.id} className="yl-tr" style={{ cursor: "default" }}>
                    <td className="yl-mono" style={{ fontSize: 12.5, color: "var(--text)" }}>{inv.invoice_no}</td>
                    <td style={{ color: "var(--text)" }}>{inv.buyer_name}</td>
                    <td style={{ color: "var(--text)" }}>{inr(grandTotal)}</td>
                    <td style={{ color: "var(--whatsapp)" }}>{inr(inv.amount_received)}</td>
                    <td style={{ color: "#E5484D", fontWeight: 600 }}>{inr(due)}</td>
                    <td><button onClick={() => setPayingId(payingId === inv.id ? null : inv.id)} className="yl-btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>Record</button></td>
                  </tr>
                  {payingId === inv.id && (
                    <tr>
                      <td colSpan={6} style={{ background: "var(--surface-2)", padding: 14 }}>
                        <div className="yl-row yl-gap-2 yl-items-center">
                          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(due)} className="yl-input" style={{ width: 140 }} />
                          <button onClick={() => recordPayment(inv, grandTotal)} disabled={!amount} className="yl-btn-primary" style={{ padding: "8px 14px" }}>Save Payment</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {pending.length === 0 && <tr><td colSpan={6} className="yl-empty">No pending payments — everything's settled.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
