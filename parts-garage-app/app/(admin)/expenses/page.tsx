"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlateBadge } from "@/components/Badges";
import CategoryPicker from "@/components/CategoryPicker";
import { EXPENSE_CATEGORIES, Expense, Vehicle, inr } from "@/lib/types";

export default function ExpensesPage() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [vehicleReg, setVehicleReg] = useState(""); const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]); const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState(""); const [date, setDate] = useState(""); const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [{ data: e }, { data: v }] = await Promise.all([
      supabase.from("expenses").select("*, vehicles(registration_number)").order("expense_date", { ascending: false }),
      supabase.from("vehicles").select("*"),
    ]);
    setExpenses((e as any) || []);
    setVehicles(v || []);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setOpen(false); setEditingId(null); setCategory(EXPENSE_CATEGORIES[0]); setAmount(""); setNote(""); setVehicleReg(""); setDate(""); setError("");
  };

  const startEdit = (e: any) => {
    setEditingId(e.id); setCategory(e.category); setVehicleReg(e.vehicles?.registration_number || ""); setAmount(String(e.amount));
    setDate(e.expense_date || ""); setNote(e.note || ""); setError(""); setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!amount) return;
    if (!category.trim()) { setError("Type a name for your expense."); return; }
    setError("");
    const vehicle = vehicles.find((v) => v.registration_number === vehicleReg);
    const row = {
      vehicle_id: vehicle?.id || null, category: category.trim(), amount: Number(amount),
      expense_date: date || new Date().toISOString().slice(0, 10), note,
    };
    if (editingId) {
      const { data, error: updateError } = await supabase.from("expenses").update(row).eq("id", editingId).select();
      if (updateError) { setError(`Could not save the change: ${updateError.message}`); return; }
      if (!data || data.length === 0) { setError("The change was not saved. Please refresh and try again."); return; }
    } else {
      const { error: saveError } = await supabase.from("expenses").insert(row);
      if (saveError) { setError(`Could not save: ${saveError.message}`); return; }
    }
    resetForm();
    load();
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="yl-topbar">
        <h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Expenses — {inr(total)} total</h1>
        <button onClick={() => (open ? resetForm() : setOpen(true))} className="yl-btn-primary">{open ? "Close" : "+ Add Expense"}</button>
      </div>
      <div className="yl-page">
        {open && (
          <div className="yl-card" style={{ padding: 20, marginBottom: 20, maxWidth: 480 }}>
            {editingId && <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", marginBottom: 12 }}>Editing this expense</div>}
            <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
              <div style={{ flex: 1 }}><label className="yl-label">Category</label>
                <CategoryPicker value={category} onChange={setCategory} />
              </div>
              <div style={{ flex: 1 }}><label className="yl-label">Vehicle (optional)</label>
                <select value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} className="yl-input" style={{ width: "100%" }}>
                  <option value="">— Business-wide —</option>
                  {vehicles.map((v) => <option key={v.registration_number} value={v.registration_number}>{v.registration_number}</option>)}
                </select>
              </div>
            </div>
            <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
              <div style={{ flex: 1 }}><label className="yl-label">Amount (₹)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
              <div style={{ flex: 1 }}><label className="yl-label">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
            </div>
            <label className="yl-label">Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="yl-input" style={{ width: "100%", marginBottom: 16 }} />
            {error && <div style={{ background: "rgba(229,72,77,0.1)", color: "#E5484D", borderRadius: 6, padding: "8px 10px", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
            <div className="yl-row yl-gap-2">
              <button onClick={handleSave} disabled={!amount} className="yl-btn-primary" style={{ flex: 1 }}>{editingId ? "Save Changes" : "Save Expense"}</button>
              {editingId && <button onClick={resetForm} className="yl-btn-ghost">Cancel</button>}
            </div>
          </div>
        )}
        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th>Date</th><th>Category</th><th>Vehicle</th><th>Amount</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="yl-tr" style={{ cursor: "default" }}>
                  <td style={{ fontSize: 12, color: "var(--text-faint)" }}>{e.expense_date}</td>
                  <td style={{ color: "var(--text)" }}>{e.category}</td>
                  <td>{e.vehicles ? <PlateBadge reg={e.vehicles.registration_number} /> : <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>Business-wide</span>}</td>
                  <td style={{ color: "var(--text)", fontWeight: 500 }}>{inr(e.amount)}</td>
                  <td style={{ fontSize: 12, color: "var(--text-faint)" }}>{e.note}</td>
                  <td><button onClick={() => startEdit(e)} className="yl-link-btn" style={{ fontSize: 12 }}>Edit</button></td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={6} className="yl-empty">No expenses recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
