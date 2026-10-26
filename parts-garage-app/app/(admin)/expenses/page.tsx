"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlateBadge } from "@/components/Badges";
import { EXPENSE_CATEGORIES, Expense, Vehicle, inr } from "@/lib/types";

export default function ExpensesPage() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [vehicleReg, setVehicleReg] = useState(""); const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]); const [customName, setCustomName] = useState("");
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

  // names you typed yourself earlier — offered in the dropdown next time
  const customCategories = Array.from(new Set(expenses.map((e) => e.category).filter((c) => c && !EXPENSE_CATEGORIES.includes(c)))).sort();
  const ADD_OWN = "__add_own__";

  const handleSave = async () => {
    if (!amount) return;
    let finalCategory = category;
    if (category === ADD_OWN) {
      const typed = customName.trim().replace(/\s+/g, " ").slice(0, 40);
      if (!typed) { setError("Type a name for your expense."); return; }
      // reuse an existing name if it only differs by capitals
      finalCategory = [...EXPENSE_CATEGORIES, ...customCategories].find((c) => c.toLowerCase() === typed.toLowerCase()) || typed;
    }
    setError("");
    const vehicle = vehicles.find((v) => v.registration_number === vehicleReg);
    const { error: saveError } = await supabase.from("expenses").insert({
      vehicle_id: vehicle?.id || null, category: finalCategory, amount: Number(amount), expense_date: date || new Date().toISOString().slice(0, 10), note,
    });
    if (saveError) { setError(`Could not save: ${saveError.message}`); return; }
    setOpen(false); setCustomName(""); setCategory(EXPENSE_CATEGORIES[0]); setAmount(""); setNote(""); setVehicleReg(""); setDate("");
    load();
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="yl-topbar">
        <h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Expenses — {inr(total)} total</h1>
        <button onClick={() => setOpen(!open)} className="yl-btn-primary">+ Add Expense</button>
      </div>
      <div className="yl-page">
        {open && (
          <div className="yl-card" style={{ padding: 20, marginBottom: 20, maxWidth: 480 }}>
            <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
              <div style={{ flex: 1 }}><label className="yl-label">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="yl-input" style={{ width: "100%" }}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  {customCategories.length > 0 && <optgroup label="Your own">{customCategories.map((c) => <option key={c}>{c}</option>)}</optgroup>}
                  <option value={ADD_OWN}>+ Add my own…</option>
                </select>
                {category === ADD_OWN && <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Expense name, e.g. Crane hire" maxLength={40} autoFocus className="yl-input" style={{ width: "100%", marginTop: 8 }} />}
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
            <button onClick={handleSave} disabled={!amount} className="yl-btn-primary" style={{ width: "100%" }}>Save Expense</button>
          </div>
        )}
        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th>Date</th><th>Category</th><th>Vehicle</th><th>Amount</th><th>Note</th></tr></thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="yl-tr" style={{ cursor: "default" }}>
                  <td style={{ fontSize: 12, color: "var(--text-faint)" }}>{e.expense_date}</td>
                  <td style={{ color: "var(--text)" }}>{e.category}</td>
                  <td>{e.vehicles ? <PlateBadge reg={e.vehicles.registration_number} /> : <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>Business-wide</span>}</td>
                  <td style={{ color: "var(--text)", fontWeight: 500 }}>{inr(e.amount)}</td>
                  <td style={{ fontSize: 12, color: "var(--text-faint)" }}>{e.note}</td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={5} className="yl-empty">No expenses recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
