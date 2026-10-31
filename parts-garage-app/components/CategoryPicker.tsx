"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EXPENSE_CATEGORIES } from "@/lib/types";

const ADD_OWN = "__add_own__";

// Expense category dropdown: the standard list, names you added yourself earlier, and "+ Add my own…".
// Calls onChange with the final category name ("" while an own name has not been typed yet).
export default function CategoryPicker({ value, onChange }: { value: string; onChange: (category: string) => void }) {
  const supabase = createClient();
  const [custom, setCustom] = useState<string[]>([]);
  const [own, setOwn] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    supabase.from("expenses").select("category").then(({ data }) => {
      setCustom(Array.from(new Set((data || []).map((r: any) => r.category as string).filter((c) => c && !EXPENSE_CATEGORIES.includes(c)))).sort());
    });
  }, []);

  // when the parent picks a listed category (e.g. after saving), leave "add my own" mode
  useEffect(() => {
    if (value && (EXPENSE_CATEGORIES.includes(value) || custom.includes(value))) setOwn(false);
  }, [value, custom]);

  const customOptions = value && !EXPENSE_CATEGORIES.includes(value) && !custom.includes(value) && !own ? [...custom, value].sort() : custom;

  const resolve = (text: string) => {
    const t = text.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!t) return "";
    return [...EXPENSE_CATEGORIES, ...customOptions].find((c) => c.toLowerCase() === t.toLowerCase()) || t; // reuse an existing name that only differs by capitals
  };

  return (
    <div>
      <select
        value={own ? ADD_OWN : value}
        onChange={(e) => {
          if (e.target.value === ADD_OWN) { setOwn(true); onChange(resolve(typed)); }
          else { setOwn(false); onChange(e.target.value); }
        }}
        className="yl-input"
        style={{ width: "100%" }}
      >
        {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        {customOptions.length > 0 && <optgroup label="Your own">{customOptions.map((c) => <option key={c}>{c}</option>)}</optgroup>}
        <option value={ADD_OWN}>+ Add my own…</option>
      </select>
      {own && (
        <input
          value={typed}
          onChange={(e) => { setTyped(e.target.value); onChange(resolve(e.target.value)); }}
          placeholder="Expense name, e.g. Crane hire"
          maxLength={40}
          autoFocus
          className="yl-input"
          style={{ width: "100%", marginTop: 8 }}
        />
      )}
    </div>
  );
}
