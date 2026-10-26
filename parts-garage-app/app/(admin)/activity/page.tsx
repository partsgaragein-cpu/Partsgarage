import { createClient } from "@/lib/supabase/server";
import { inr } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  id: number; created_at: string; user_name: string; action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string; record_label: string | null; old_data: any; new_data: any;
};

const TABLE_LABELS: Record<string, string> = {
  vehicles: "Vehicle", parts: "Part", invoices: "Invoice", invoice_items: "Invoice line", expenses: "Expense", media: "Photo/Video",
};
const PRIORITY = ["invoices", "expenses", "vehicles", "parts", "media", "invoice_items"];
const VERB: Record<string, string> = { INSERT: "Added", UPDATE: "Changed", DELETE: "Deleted" };
const COLOR: Record<string, string> = { INSERT: "#30A46C", UPDATE: "#F5A524", DELETE: "#E5484D" };
const SKIP = new Set(["id", "created_at"]);
const GROUP_GAP_MS = 20000; // steps by the same person within 20s belong to one action

const show = (v: any) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return typeof v === "object" ? JSON.stringify(v) : String(v);
};
const nice = (k: string) => k.replace(/_/g, " ");

function fieldChanges(r: Row): string[] {
  if (r.action !== "UPDATE") return [];
  const o = r.old_data || {}, n = r.new_data || {};
  return Object.keys(n).filter((k) => !SKIP.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => `${nice(k)}: ${show(o[k])} → ${show(n[k])}`);
}

// one line per raw database step (shown when a group is expanded)
function stepText(r: Row): string {
  const d = r.new_data || r.old_data || {};
  const extra = r.action === "UPDATE" ? fieldChanges(r).join(", ") : r.table_name === "expenses" && d.amount ? inr(Number(d.amount)) : "";
  return `${VERB[r.action]} ${TABLE_LABELS[r.table_name] || r.table_name} · ${r.record_label || "—"}${extra ? " — " + extra : ""}`;
}

function groupRows(rows: Row[]): Row[][] {
  const groups: Row[][] = [];
  for (const r of rows) {
    const g = groups[groups.length - 1];
    const prev = g && g[g.length - 1];
    if (g && prev.user_name === r.user_name && new Date(prev.created_at).getTime() - new Date(r.created_at).getTime() <= GROUP_GAP_MS) g.push(r);
    else groups.push([r]);
  }
  return groups;
}

function headline(g: Row[]): { action: string; title: string; detail: string } {
  const primary = [...g].sort((a, b) => PRIORITY.indexOf(a.table_name) - PRIORITY.indexOf(b.table_name))[0];
  const d = primary.new_data || primary.old_data || {};
  const lines = g.filter((x) => x.table_name === "invoice_items");

  if (primary.table_name === "invoices") {
    if (primary.action === "INSERT") {
      const added = lines.filter((l) => l.action === "INSERT");
      const total = added.reduce((s, l) => s + Number(l.new_data.taxable_value) * Number(l.new_data.qty) * (1 + Number(l.new_data.gst_percent) / 100), 0);
      const bits = [d.buyer_name, `${added.length} part${added.length === 1 ? "" : "s"}`, added.length ? inr(total) : ""];
      if (Number(d.amount_received) > 0) bits.push(`received ${inr(Number(d.amount_received))}${d.payment_method ? " by " + d.payment_method : ""}${d.paid_to ? " → " + d.paid_to : ""}`);
      return { action: "INSERT", title: `Created invoice ${primary.record_label}`, detail: bits.filter(Boolean).join(" · ") };
    }
    if (primary.action === "DELETE") return { action: "DELETE", title: `Deleted invoice ${primary.record_label}`, detail: "" };
    const bits = fieldChanges(primary);
    const a = lines.filter((l) => l.action === "INSERT").length, rm = lines.filter((l) => l.action === "DELETE").length, ch = lines.filter((l) => l.action === "UPDATE").length;
    if (a) bits.push(`${a} part${a === 1 ? "" : "s"} added`);
    if (rm) bits.push(`${rm} part${rm === 1 ? "" : "s"} removed`);
    if (ch) bits.push(`${ch} line${ch === 1 ? "" : "s"} edited`);
    return { action: "UPDATE", title: `Edited invoice ${primary.record_label}`, detail: bits.join(" · ") };
  }

  const label = TABLE_LABELS[primary.table_name]?.toLowerCase() || primary.table_name;
  const detail = primary.action === "UPDATE" ? fieldChanges(primary).join(" · ") : primary.table_name === "expenses" && d.amount ? inr(Number(d.amount)) : "";
  return { action: primary.action, title: `${VERB[primary.action]} ${label} ${primary.record_label || ""}`.trim(), detail };
}

export default async function ActivityPage({ searchParams }: { searchParams: { user?: string; table?: string } }) {
  const supabase = createClient();
  let q = supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(500);
  if (searchParams.user) q = q.eq("user_name", searchParams.user);
  if (searchParams.table) q = q.eq("table_name", searchParams.table);
  const [{ data: rows, error }, { data: names }] = await Promise.all([q, supabase.from("activity_log").select("user_name").limit(1000)]);
  const people = Array.from(new Set((names || []).map((r: any) => r.user_name as string))).sort();
  const groups = groupRows((rows || []) as Row[]);

  // "Latest" strip: most recent thing of each kind, and who did it
  const { data: recent } = await supabase.from("activity_log").select("*").in("table_name", ["invoices", "vehicles", "parts", "expenses"]).order("created_at", { ascending: false }).limit(300);
  const rec = (recent || []) as Row[];
  const changedKeys = (r: Row) => Object.keys(r.new_data || {}).filter((k) => JSON.stringify((r.old_data || {})[k]) !== JSON.stringify(r.new_data[k]));
  const isPayment = (r: Row) => r.action === "UPDATE" && Number((r.old_data || {}).amount_received) !== Number((r.new_data || {}).amount_received);
  const latest: { label: string; row?: Row }[] = [
    { label: "Last invoice created", row: rec.find((r) => r.table_name === "invoices" && r.action === "INSERT") },
    { label: "Last invoice edited", row: rec.find((r) => r.table_name === "invoices" && r.action === "UPDATE" && !isPayment(r)) },
    { label: "Last payment recorded", row: rec.find((r) => r.table_name === "invoices" && isPayment(r)) },
    { label: "Last vehicle added", row: rec.find((r) => r.table_name === "vehicles" && r.action === "INSERT") },
    { label: "Last vehicle edited", row: rec.find((r) => r.table_name === "vehicles" && r.action === "UPDATE" && !changedKeys(r).every((k) => k === "fully_sold_at")) },
    { label: "Last part added", row: rec.find((r) => r.table_name === "parts" && r.action === "INSERT") },
    { label: "Last expense added", row: rec.find((r) => r.table_name === "expenses" && r.action === "INSERT") },
  ];

  const chip = (href: string, text: string, active: boolean) => (
    <Link key={href + text} href={href} className={active ? "yl-btn-primary" : "yl-btn-ghost"} style={{ fontSize: 12, padding: "5px 10px" }}>{text}</Link>
  );
  const link = (u?: string, t?: string) => `/activity?${[u ? `user=${encodeURIComponent(u)}` : "", t ? `table=${t}` : ""].filter(Boolean).join("&")}`;
  const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  const Summary = ({ g }: { g: Row[] }) => {
    const h = headline(g);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "110px 90px 1fr auto", gap: 12, alignItems: "baseline", padding: "11px 14px" }}>
        <span style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{when(g[0].created_at)}</span>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{g[0].user_name}</span>
        <span>
          <span style={{ color: COLOR[h.action], fontWeight: 600, fontSize: 13 }}>{h.title}</span>
          {h.detail && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{h.detail}</div>}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{g.length > 1 ? `${g.length} steps ▾` : ""}</span>
      </div>
    );
  };

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Activity</h1></div>
      <div className="yl-page">
        <div className="yl-card" style={{ padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 8 }}>Latest</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "6px 20px", fontSize: 12.5 }}>
            {latest.map((l) => (
              <div key={l.label} style={{ color: "var(--text-muted)" }}>
                {l.label}: {l.row ? <><b style={{ color: "var(--text)" }}>{l.row.user_name}</b>{l.row.record_label ? ` · ${l.row.record_label}` : ""} <span style={{ color: "var(--text-faint)" }}>({when(l.row.created_at)})</span></> : <span style={{ color: "var(--text-faint)" }}>—</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="yl-row yl-gap-2" style={{ flexWrap: "wrap", marginBottom: 10 }}>
          {chip(link(undefined, searchParams.table), "Everyone", !searchParams.user)}
          {people.map((p) => chip(link(p, searchParams.table), p, searchParams.user === p))}
        </div>
        <div className="yl-row yl-gap-2" style={{ flexWrap: "wrap", marginBottom: 16 }}>
          {chip(link(searchParams.user), "All records", !searchParams.table)}
          {Object.entries(TABLE_LABELS).map(([k, v]) => chip(link(searchParams.user, k), v, searchParams.table === k))}
        </div>

        {error && <div style={{ color: "#E5484D", fontSize: 13, marginBottom: 12 }}>Could not load activity: {error.message}</div>}

        <div className="yl-card" style={{ overflowX: "auto" }}>
          {groups.map((g) => (
            <div key={g[0].id} style={{ borderBottom: "1px solid var(--border)", minWidth: 560 }}>
              {g.length > 1 ? (
                <details>
                  <summary style={{ cursor: "pointer", listStyle: "none" }}><Summary g={g} /></summary>
                  <div style={{ padding: "2px 14px 12px 224px", fontSize: 12, color: "var(--text-muted)" }}>
                    {[...g].reverse().map((r) => <div key={r.id} style={{ padding: "2px 0" }}>• {stepText(r)}</div>)}
                  </div>
                </details>
              ) : <Summary g={g} />}
            </div>
          ))}
          {groups.length === 0 && <div className="yl-empty" style={{ padding: 24 }}>No activity recorded yet. Changes made from now on will appear here.</div>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 10 }}>Steps by the same person within a few seconds are grouped into one action. Tap a line with "steps" to see each change.</div>
      </div>
    </div>
  );
}
