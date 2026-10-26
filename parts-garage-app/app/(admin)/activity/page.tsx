import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TABLE_LABELS: Record<string, string> = {
  vehicles: "Vehicle", parts: "Part", invoices: "Invoice", invoice_items: "Invoice line", expenses: "Expense", media: "Photo/Video",
};
const SKIP = new Set(["id", "created_at"]);
const ACTION_STYLE: Record<string, { label: string; color: string }> = {
  INSERT: { label: "Added", color: "#30A46C" }, UPDATE: { label: "Changed", color: "#F5A524" }, DELETE: { label: "Deleted", color: "#E5484D" },
};

const show = (v: any) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

function changes(row: any): string[] {
  if (row.action !== "UPDATE") return [];
  const o = row.old_data || {}, n = row.new_data || {};
  return Object.keys(n).filter((k) => !SKIP.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => `${k.replace(/_/g, " ")}: ${show(o[k])} → ${show(n[k])}`);
}

export default async function ActivityPage({ searchParams }: { searchParams: { user?: string; table?: string } }) {
  const supabase = createClient();
  let q = supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(300);
  if (searchParams.user) q = q.eq("user_name", searchParams.user);
  if (searchParams.table) q = q.eq("table_name", searchParams.table);
  const [{ data: rows, error }, { data: names }] = await Promise.all([q, supabase.from("activity_log").select("user_name").limit(1000)]);
  const people = Array.from(new Set((names || []).map((r: any) => r.user_name as string))).sort();

  const chip = (href: string, text: string, active: boolean) => (
    <Link key={href + text} href={href} className={active ? "yl-btn-primary" : "yl-btn-ghost"} style={{ fontSize: 12, padding: "5px 10px" }}>{text}</Link>
  );
  const link = (u?: string, t?: string) => `/activity?${[u ? `user=${encodeURIComponent(u)}` : "", t ? `table=${t}` : ""].filter(Boolean).join("&")}`;

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Activity</h1></div>
      <div className="yl-page">
        <div className="yl-row yl-gap-2" style={{ flexWrap: "wrap", marginBottom: 10 }}>
          {chip(link(undefined, searchParams.table), "Everyone", !searchParams.user)}
          {people.map((p) => chip(link(p, searchParams.table), p, searchParams.user === p))}
        </div>
        <div className="yl-row yl-gap-2" style={{ flexWrap: "wrap", marginBottom: 16 }}>
          {chip(link(searchParams.user), "All records", !searchParams.table)}
          {Object.entries(TABLE_LABELS).map(([k, v]) => chip(link(searchParams.user, k), v, searchParams.table === k))}
        </div>

        {error && <div style={{ color: "#E5484D", fontSize: 13, marginBottom: 12 }}>Could not load activity: {error.message}</div>}

        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>Record</th><th>Details</th></tr></thead>
            <tbody>
              {(rows || []).map((r: any) => {
                const a = ACTION_STYLE[r.action];
                const ch = changes(r);
                return (
                  <tr key={r.id} className="yl-tr" style={{ cursor: "default", verticalAlign: "top" }}>
                    <td style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                    <td style={{ color: "var(--text)", fontWeight: 500 }}>{r.user_name}</td>
                    <td><span style={{ color: a.color, fontWeight: 600, fontSize: 12 }}>{a.label}</span> <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{TABLE_LABELS[r.table_name] || r.table_name}</span></td>
                    <td style={{ color: "var(--text)", fontSize: 12.5 }}>{r.record_label || "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{ch.length ? ch.map((c, i) => <div key={i}>{c}</div>) : "—"}</td>
                  </tr>
                );
              })}
              {(!rows || rows.length === 0) && <tr><td colSpan={5} className="yl-empty">No activity recorded yet. Changes made from now on will appear here.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
