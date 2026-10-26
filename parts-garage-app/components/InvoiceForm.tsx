"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GST_RATES, PAYMENT_TERMS, TERMS_DAYS, PAYMENT_METHODS, PAID_TO, Part, inr } from "@/lib/types";

type LineItem = {
  itemId?: string; // set for lines that already exist on a saved invoice
  partId: string; description: string; category: string; hsnSac: string;
  qty: number; taxableValue: number; gstPercent: number;
};

// Shared by "New Invoice" and "Edit Invoice". Pass `initial` to edit.
export default function InvoiceForm({ initial }: { initial?: { invoice: any; items: any[] } }) {
  const router = useRouter();
  const supabase = createClient();
  const inv = initial?.invoice;
  const editing = !!inv;

  const [parts, setParts] = useState<Part[]>([]);
  const [buyerName, setBuyerName] = useState(inv?.buyer_name || ""); const [buyerPhone, setBuyerPhone] = useState(inv?.buyer_phone || "");
  const [buyerGSTIN, setBuyerGSTIN] = useState(inv?.buyer_gstin || ""); const [buyerVehicle, setBuyerVehicle] = useState(inv?.buyer_vehicle || "");
  const [date, setDate] = useState(inv?.invoice_date || new Date().toISOString().slice(0, 10));
  const [paymentTerms, setPaymentTerms] = useState(inv?.payment_terms || PAYMENT_TERMS[0]); const [dueDate, setDueDate] = useState(inv?.due_date || "");
  const [amountReceived, setAmountReceived] = useState(inv ? String(inv.amount_received ?? "") : "");
  const [paymentMethod, setPaymentMethod] = useState(inv?.payment_method || "");
  const [paidTo, setPaidTo] = useState(inv?.paid_to || "");
  const [markAsSold, setMarkAsSold] = useState(true);
  const [items, setItems] = useState<LineItem[]>(
    (initial?.items || []).map((it) => ({
      itemId: it.id, partId: it.part_id, description: it.description, category: it.category || "", hsnSac: it.hsn_sac || "",
      qty: Number(it.qty), taxableValue: Number(it.taxable_value), gstPercent: Number(it.gst_percent),
    }))
  );
  const [pickerPart, setPickerPart] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("parts").select("*").eq("archived", false).then(({ data }) => {
      setParts(data || []);
      if (data && data[0]) setPickerPart(data[0].id);
    });
    if (!editing) {
      const d = new Date(); d.setDate(d.getDate() + TERMS_DAYS[PAYMENT_TERMS[0]]);
      setDueDate(d.toISOString().slice(0, 10));
    }
  }, []);

  const applyTerms = (terms: string) => {
    setPaymentTerms(terms);
    const d = new Date(date); d.setDate(d.getDate() + (TERMS_DAYS[terms] || 0));
    setDueDate(d.toISOString().slice(0, 10));
  };

  const addItem = () => {
    const p = parts.find((x) => x.id === pickerPart);
    if (!p || items.some((it) => it.partId === p.id)) return;
    setItems((prev) => [...prev, { partId: p.id, description: p.name, category: p.category, hsnSac: p.hsn_sac || "", qty: 1, taxableValue: p.expected_price, gstPercent: 18 }]);
  };
  const updateItem = (i: number, field: keyof LineItem, value: any) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, it) => s + it.taxableValue * it.qty, 0);
  const totalGST = items.reduce((s, it) => s + (it.taxableValue * it.qty * it.gstPercent) / 100, 0);
  const grandTotal = subtotal + totalGST;
  const received = Math.min(Number(amountReceived) || 0, grandTotal);

  const handleSave = async () => {
    setError("");
    if (!buyerName || items.length === 0) return;
    if (received > 0 && (!paymentMethod || !paidTo)) {
      setError("Please choose how the money was paid (Cash / Online) and who received it (Sarthak / Sunny).");
      return;
    }
    setSaving(true);

    const fields = {
      invoice_date: date, buyer_name: buyerName, buyer_phone: buyerPhone, buyer_gstin: buyerGSTIN, buyer_vehicle: buyerVehicle,
      payment_terms: paymentTerms, due_date: dueDate || null, amount_received: received,
      payment_method: received > 0 ? paymentMethod : null, paid_to: received > 0 ? paidTo : null,
    };
    const itemRow = (it: LineItem) => ({
      part_id: it.partId, description: it.description, category: it.category, hsn_sac: it.hsnSac,
      qty: it.qty, taxable_value: it.taxableValue, gst_percent: it.gstPercent,
    });

    try {
      if (!editing) {
        const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
        const invoiceNo = `PG-${String((count || 0) + 1).padStart(5, "0")}`;
        const { data: created, error: e1 } = await supabase.from("invoices").insert({ invoice_no: invoiceNo, ...fields }).select().single();
        if (e1 || !created) throw new Error(`Could not create the invoice: ${e1?.message || "unknown error"}`);

        const { error: e2 } = await supabase.from("invoice_items").insert(items.map((it) => ({ invoice_id: created.id, ...itemRow(it) })));
        if (e2) {
          alert(`Invoice ${invoiceNo} was created but its parts could not be saved (${e2.message}). Add the parts on the next screen.`);
          router.push(`/invoices/${created.id}/edit`);
          return;
        }
        if (markAsSold) {
          await Promise.all(items.map((it) => supabase.from("parts").update({ status: "Sold", actual_price: it.taxableValue * it.qty }).eq("id", it.partId)));
        }
        router.push(`/invoices/${created.id}`);
        return;
      }

      // ---- editing an existing invoice ----
      const { error: e1 } = await supabase.from("invoices").update(fields).eq("id", inv.id);
      if (e1) throw new Error(`Could not save the invoice: ${e1.message}`);

      const keptIds = new Set(items.filter((it) => it.itemId).map((it) => it.itemId));
      const removed = (initial?.items || []).filter((it) => !keptIds.has(it.id));

      for (const it of items.filter((x) => x.itemId)) {
        const { error: eu } = await supabase.from("invoice_items").update(itemRow(it)).eq("id", it.itemId!);
        if (eu) throw new Error(`Could not update "${it.description}": ${eu.message}`);
      }
      const fresh = items.filter((x) => !x.itemId);
      if (fresh.length) {
        const { error: ei } = await supabase.from("invoice_items").insert(fresh.map((it) => ({ invoice_id: inv.id, ...itemRow(it) })));
        if (ei) throw new Error(`Could not add the new parts: ${ei.message}`);
      }
      if (removed.length) {
        const { error: ed } = await supabase.from("invoice_items").delete().in("id", removed.map((r) => r.id));
        if (ed) throw new Error(`Could not remove parts: ${ed.message}`);
        // parts taken off the invoice go back on the shelf
        await Promise.all(removed.map((r) => supabase.from("parts").update({ status: "Available", actual_price: null }).eq("id", r.part_id).eq("status", "Sold")));
      }
      if (markAsSold) {
        await Promise.all(items.map((it) => supabase.from("parts").update({ status: "Sold", actual_price: it.taxableValue * it.qty }).eq("id", it.partId)));
      }
      router.push(`/invoices/${inv.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Nothing more was saved.");
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>{editing ? `Edit Invoice ${inv.invoice_no}` : "New Invoice"}</h1></div>
      <div className="yl-page" style={{ maxWidth: 640 }}>
        <div className="yl-row yl-gap-3" style={{ marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}><label className="yl-label">Buyer Name</label><input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
          <div style={{ flex: 1, minWidth: 200 }}><label className="yl-label">Buyer Phone</label><input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
        </div>
        <div className="yl-row yl-gap-3" style={{ marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}><label className="yl-label">Buyer GSTIN (optional)</label><input value={buyerGSTIN} onChange={(e) => setBuyerGSTIN(e.target.value.toUpperCase())} className="yl-input yl-mono" style={{ width: "100%" }} /></div>
          <div style={{ flex: 1, minWidth: 200 }}><label className="yl-label">Buyer's Vehicle</label><input value={buyerVehicle} onChange={(e) => setBuyerVehicle(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", margin: "18px 0" }} />

        <div className="yl-row yl-items-center yl-justify-between" style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{markAsSold ? "Mark listed parts as sold" : "Don't change part status"}</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{markAsSold ? "Parts will flip to Sold when saved" : "Use if parts were already marked sold"}</div>
          </div>
          <span className={`yl-switch${markAsSold ? " on" : ""}`} onClick={() => setMarkAsSold(!markAsSold)}><span className="yl-switch-knob" /></span>
        </div>

        <label className="yl-label">Add Part to Invoice</label>
        <div className="yl-row yl-gap-2" style={{ flexWrap: "wrap", marginBottom: 16 }}>
          <select value={pickerPart} onChange={(e) => setPickerPart(e.target.value)} className="yl-input" style={{ flex: 1, minWidth: 160 }}>
            {parts.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.status}</option>)}
          </select>
          <button onClick={addItem} className="yl-btn-ghost">Add</button>
        </div>

        {items.map((it, i) => (
          <div key={it.itemId || it.partId} style={{ background: "var(--surface-2)", borderRadius: 6, padding: 10, marginBottom: 8 }}>
            <div className="yl-row yl-items-center yl-justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{it.description}</span>
              <button onClick={() => removeItem(i)} className="yl-icon-btn" style={{ width: 22, height: 22 }}>✕</button>
            </div>
            <div className="yl-row yl-gap-2" style={{ marginBottom: 8 }}>
              <input value={it.hsnSac} onChange={(e) => updateItem(i, "hsnSac", e.target.value)} placeholder="HSN/SAC" className="yl-input yl-mono" style={{ flex: 1, fontSize: 12, padding: "6px 8px" }} />
              <input type="number" value={it.qty} onChange={(e) => updateItem(i, "qty", Number(e.target.value) || 1)} className="yl-input" style={{ width: 60, fontSize: 12, padding: "6px 8px" }} />
            </div>
            <div className="yl-row yl-gap-2">
              <input type="number" value={it.taxableValue} onChange={(e) => updateItem(i, "taxableValue", Number(e.target.value) || 0)} className="yl-input" style={{ flex: 1, fontSize: 12, padding: "6px 8px" }} />
              <select value={it.gstPercent} onChange={(e) => updateItem(i, "gstPercent", Number(e.target.value))} className="yl-input" style={{ width: 78, fontSize: 12, padding: "6px 8px" }}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select>
            </div>
          </div>
        ))}

        <div style={{ background: "var(--surface-2)", borderRadius: 6, padding: "10px 12px", margin: "16px 0", fontSize: 12.5, color: "var(--text-muted)" }}>
          <div className="yl-row yl-justify-between"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
          <div className="yl-row yl-justify-between"><span>GST</span><span>{inr(totalGST)}</span></div>
          <div className="yl-row yl-justify-between" style={{ color: "var(--text)", fontWeight: 600 }}><span>Grand Total</span><span>{inr(grandTotal)}</span></div>
        </div>

        <div className="yl-row yl-gap-3" style={{ marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 150 }}><label className="yl-label">Invoice Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
          <div style={{ flex: 1, minWidth: 150 }}><label className="yl-label">Payment Terms</label><select value={paymentTerms} onChange={(e) => applyTerms(e.target.value)} className="yl-input" style={{ width: "100%" }}>{PAYMENT_TERMS.map((t) => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div className="yl-row yl-gap-3" style={{ marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 150 }}><label className="yl-label">Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
          <div style={{ flex: 1, minWidth: 150 }}><label className="yl-label">Amount Received (₹)</label><input type="number" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
        </div>
        <div className="yl-row yl-gap-3" style={{ marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="yl-label">Amount Paid By</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="yl-input" style={{ width: "100%" }}>
              <option value="">— Select —</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="yl-label">Amount Paid To</label>
            <select value={paidTo} onChange={(e) => setPaidTo(e.target.value)} className="yl-input" style={{ width: "100%" }}>
              <option value="">— Select —</option>{PAID_TO.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {error && <div style={{ background: "rgba(229,72,77,0.1)", color: "#E5484D", borderRadius: 6, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

        <button onClick={handleSave} disabled={!buyerName || items.length === 0 || saving} className="yl-btn-primary" style={{ width: "100%" }}>
          {saving ? "Saving…" : editing ? "Save Changes" : "Create Invoice"}
        </button>
      </div>
    </div>
  );
}
