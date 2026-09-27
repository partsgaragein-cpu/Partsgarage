"use client";

import { useState } from "react";
import { VehicleCell } from "@/components/Badges";
import { inr } from "@/lib/types";

type Row = { id: string; name: string; storage_location: string | null; expected_price: number; priority: boolean; reg: string | null };

export default function VerificationChecklist({ rows }: { rows: Row[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="yl-card yl-table-wrap">
      <table className="yl-table">
        <thead><tr><th></th><th>Part</th><th>Location</th><th>Vehicle</th><th>Expected Price</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const done = checked.has(r.id);
            return (
              <tr key={r.id} className="yl-tr" onClick={() => toggle(r.id)}>
                <td style={{ fontSize: 15 }}>{done ? "✅" : "⚠️"}</td>
                <td style={{ color: "var(--text)" }}>
                  {r.priority && <span title="Priority part" style={{ color: "var(--accent)", marginRight: 4 }}>★</span>}
                  {r.name}
                </td>
                <td style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{r.storage_location}</td>
                <td><VehicleCell reg={r.reg} /></td>
                <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{inr(r.expected_price)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={5} className="yl-empty">No high-value or priority parts pending verification.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
