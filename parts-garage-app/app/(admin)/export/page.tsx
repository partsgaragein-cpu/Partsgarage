"use client";

import { useState } from "react";
import { EXPORT_SECTIONS } from "@/lib/exportSections";

export default function ExportPage() {
  const [section, setSection] = useState<string>(EXPORT_SECTIONS[0].key);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<"" | "all" | "one">("");
  const [error, setError] = useState("");

  const download = async (url: string, kind: "all" | "one") => {
    setBusy(kind);
    setError("");
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Export failed (${res.status}).`);
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "parts-garage-export";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e: any) {
      setError(e?.message || "Export failed. Please try again.");
    } finally {
      setBusy("");
    }
  };

  const chosen = EXPORT_SECTIONS.find((s) => s.key === section)!;
  const query = new URLSearchParams({ section, ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Export</h1></div>
      <div className="yl-page" style={{ maxWidth: 560 }}>
        {error && <div style={{ background: "rgba(229,72,77,0.1)", color: "#E5484D", borderRadius: 6, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

        <div className="yl-card" style={{ padding: 20, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Download everything</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
            One ZIP file with a separate CSV for cars, parts, photos list, expenses, invoices, invoice lines and the activity log. All dates, no filters.
          </div>
          <button onClick={() => download("/api/export?section=all", "all")} disabled={busy !== ""} className="yl-btn-primary" style={{ width: "100%" }}>
            {busy === "all" ? "Preparing your file…" : "Download everything (ZIP)"}
          </button>
        </div>

        <div className="yl-card" style={{ padding: 20, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Download one section</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>Choose what you need and, if you like, a date range. Leave the dates empty for everything.</div>

          <label className="yl-label">Section</label>
          <select value={section} onChange={(e) => setSection(e.target.value)} className="yl-input" style={{ width: "100%", marginBottom: 14 }}>
            {EXPORT_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>

          <div className="yl-row yl-gap-3" style={{ marginBottom: 6 }}>
            <div style={{ flex: 1 }}><label className="yl-label">From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
            <div style={{ flex: 1 }}><label className="yl-label">To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 14 }}>Dates filter by {chosen.dateField}.</div>

          <button onClick={() => download(`/api/export?${query}`, "one")} disabled={busy !== "" || (!!from && !!to && from > to)} className="yl-btn-primary" style={{ width: "100%" }}>
            {busy === "one" ? "Preparing your file…" : "Download CSV"}
          </button>
          {from && to && from > to && <div style={{ fontSize: 12, color: "#E5484D", marginTop: 8 }}>The “From” date is after the “To” date.</div>}
        </div>

        <div style={{ fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.6 }}>
          CSV files open in Excel and Google Sheets. Exports are for reading and for your accountant; they are not the nightly backup and can&apos;t be used to restore the system.
        </div>
      </div>
    </div>
  );
}
