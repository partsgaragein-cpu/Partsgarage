import { createClient } from "@/lib/supabase/server";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Small "Created by … · Last edited by …" line, read from the activity log.
export default async function LastChanged({ table, id }: { table: "invoices" | "vehicles" | "parts"; id: string }) {
  const supabase = createClient();
  let q = supabase.from("activity_log").select("created_at, user_name, action, table_name, old_data, new_data").order("created_at", { ascending: false }).limit(60);
  q = table === "invoices"
    ? q.or(`and(table_name.eq.invoices,record_id.eq.${id}),and(table_name.eq.invoice_items,new_data->>invoice_id.eq.${id}),and(table_name.eq.invoice_items,old_data->>invoice_id.eq.${id})`)
    : q.eq("table_name", table).eq("record_id", id);
  const { data } = await q;
  const rows = (data || []) as any[];

  const created = rows.find((r) => r.table_name === table && r.action === "INSERT");
  const edited = rows.find((r) => {
    if (created && new Date(r.created_at).getTime() - new Date(created.created_at).getTime() <= 20000 && r.user_name === created.user_name) return false; // still part of creating it
    if (r.action !== "UPDATE" || r.table_name !== table) return r.table_name === "invoice_items"; // invoice line edits count for invoices
    const o = r.old_data || {}, n = r.new_data || {};
    const changed = Object.keys(n).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]));
    return !(table === "vehicles" && changed.every((k) => k === "fully_sold_at")); // ignore the automatic "fully sold" stamp
  });

  if (!created && !edited) return <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No changes recorded since tracking began.</div>;
  return (
    <div className="no-print" style={{ fontSize: 12, color: "var(--text-faint)" }}>
      {created ? <>Created by <b style={{ color: "var(--text-muted)" }}>{created.user_name}</b>, {when(created.created_at)}</> : "Created before tracking began"}
      {edited && <> · Last edited by <b style={{ color: "var(--text-muted)" }}>{edited.user_name}</b>, {when(edited.created_at)}</>}
    </div>
  );
}
