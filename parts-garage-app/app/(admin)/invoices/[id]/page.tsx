import { createClient } from "@/lib/supabase/server";
import { COMPANY, inr } from "@/lib/types";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: invoice } = await supabase.from("invoices").select("*, invoice_items(*)").eq("id", params.id).single();
  if (!invoice) notFound();

  const subtotal = invoice.invoice_items.reduce((s: number, it: any) => s + it.taxable_value * it.qty, 0);
  const totalGST = invoice.invoice_items.reduce((s: number, it: any) => s + (it.taxable_value * it.qty * it.gst_percent) / 100, 0);
  const grandTotal = subtotal + totalGST;
  const due = Math.max(grandTotal - invoice.amount_received, 0);
  const status = due <= 0 ? "PAID" : invoice.amount_received > 0 ? "PARTIALLY PAID" : "UNPAID";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-public)" }}>
      <div className="no-print yl-row yl-items-center yl-justify-between" style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
        <a href="/invoices" className="yl-link-btn">← Back</a>
        <PrintButton />
      </div>

      <div className="yl-invoice-print" style={{ maxWidth: 720, margin: "0 auto", padding: 28, background: "#fff", color: "#111", fontSize: 12.5 }}>
        <div className="yl-row yl-items-center yl-justify-between" style={{ marginBottom: 4, flexWrap: "wrap", gap: 6 }}>
          <div className="yl-display yl-fw-700" style={{ fontSize: 20, color: "#111" }}>{COMPANY.name}</div>
          <div style={{ fontSize: 11, color: "#555", textAlign: "right" }}>TAX INVOICE<br />Genuine &amp; Used Auto Parts</div>
        </div>
        <div style={{ borderBottom: "2px solid #111", marginBottom: 14 }} />

        <div className="yl-row yl-gap-4" style={{ marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>SELLER DETAILS</div>
            <div>Business: {COMPANY.name}</div><div>GSTIN: {COMPANY.gstin}</div><div>Address: {COMPANY.address}</div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>INVOICE DETAILS</div>
            <div>Invoice No.: {invoice.invoice_no}</div><div>Invoice Date: {invoice.invoice_date}</div><div>Place of Supply: {invoice.place_of_supply || COMPANY.state}</div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>BUYER DETAILS</div>
          <div className="yl-row yl-gap-4" style={{ flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}><div>Buyer Name: {invoice.buyer_name}</div><div>Mobile: {invoice.buyer_phone}</div></div>
            <div style={{ flex: 1, minWidth: 200 }}><div>Buyer GSTIN: {invoice.buyer_gstin || "—"}</div><div>Vehicle: {invoice.buyer_vehicle || "—"}</div></div>
          </div>
        </div>

        <div style={{ overflowX: "auto", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead><tr style={{ borderTop: "1px solid #111", borderBottom: "1px solid #111" }}>
              {["S.No.", "Part Description", "HSN/SAC", "Qty", "Taxable Value", "GST %", "GST Amt.", "Total"].map((h) => <th key={h} style={{ textAlign: "left", padding: "5px 6px", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {invoice.invoice_items.map((it: any, i: number) => {
                const gstAmt = (it.taxable_value * it.qty * it.gst_percent) / 100;
                return (
                  <tr key={it.id} style={{ borderBottom: "1px solid #ddd" }}>
                    <td style={{ padding: "5px 6px" }}>{i + 1}</td><td style={{ padding: "5px 6px" }}>{it.description}</td>
                    <td style={{ padding: "5px 6px" }}>{it.hsn_sac || "—"}</td><td style={{ padding: "5px 6px" }}>{it.qty}</td>
                    <td style={{ padding: "5px 6px" }}>{inr(it.taxable_value)}</td><td style={{ padding: "5px 6px" }}>{it.gst_percent}%</td>
                    <td style={{ padding: "5px 6px" }}>{inr(gstAmt)}</td><td style={{ padding: "5px 6px" }}>{inr(it.taxable_value * it.qty + gstAmt)}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "1px solid #111", fontWeight: 700 }}>
                <td colSpan={4}></td><td style={{ padding: "5px 6px" }}>{inr(subtotal)}</td><td></td><td style={{ padding: "5px 6px" }}>{inr(totalGST)}</td><td style={{ padding: "5px 6px" }}>{inr(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ border: "1px solid #111", padding: 10, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>PAYMENT SUMMARY</div>
          <div className="yl-row yl-justify-between"><span>Grand Total Amount</span><strong>{inr(grandTotal)}</strong></div>
          <div className="yl-row yl-justify-between"><span>Amount Received</span><span>{inr(invoice.amount_received)}</span></div>
          <div className="yl-row yl-justify-between"><span>Due Amount</span><span>{inr(due)}</span></div>
          <div className="yl-row yl-justify-between"><span>Due Payment Terms</span><span>{invoice.payment_terms}</span></div>
          <div className="yl-row yl-justify-between"><span>Due Date</span><span>{invoice.due_date}</span></div>
          <div className="yl-row yl-justify-between"><span>Payment Status</span><strong>{status}</strong></div>
        </div>

        <div style={{ fontSize: 10.5, color: "#444", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>IMPORTANT TERMS &amp; NOTES</div>
          <div>1. 48-hour replacement facility is available only for eligible parts, subject to testing, verification and approval.</div>
          <div>2. After 48 hours from delivery/purchase, no replacement or claim will be accepted.</div>
          <div>3. Returned parts must be in the same condition. Opened, damaged, modified or tampered parts are not eligible for replacement.</div>
          <div>4. Outstanding due amounts are payable within the agreed terms from the invoice date unless otherwise agreed in writing.</div>
          <div>5. No cash refund. Replacement is subject to stock availability and {COMPANY.name} approval.</div>
        </div>

        <div className="yl-row yl-justify-between" style={{ marginTop: 30 }}>
          <div>Customer Signature: ______________________</div>
          <div>Authorized Signature: ______________________</div>
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#666" }}>Thank you for choosing {COMPANY.name}.</div>
      </div>
    </div>
  );
}
