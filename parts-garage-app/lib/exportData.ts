import type { SupabaseClient } from "@supabase/supabase-js";
import { Cell, toCsv } from "@/lib/csv";
import { EXPORT_SECTIONS, ExportSectionKey } from "@/lib/exportSections";

export type Range = { from?: string; to?: string }; // YYYY-MM-DD, inclusive, India time
export type SectionResult = { key: ExportSectionKey; filename: string; csv: string; rows: number };

const PAGE = 1000; // Supabase returns at most 1,000 rows per request without warning, so always page.
const SKIP_DIFF = new Set(["id", "created_at"]);

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ist = (ts: string | null | undefined) => (ts ? new Date(ts).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }) : "");
const fromTs = (d: string) => `${d}T00:00:00+05:30`;
const toTs = (d: string) => `${d}T23:59:59.999+05:30`;

async function fetchAll(supabase: SupabaseClient, table: string, filter?: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let q: any = supabase.from(table).select("*");
    if (filter) q = filter(q);
    const { data, error } = await q.order(table === "profiles" ? "user_id" : "id").range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const tsFilter = (r: Range) => (q: any) => { if (r.from) q = q.gte("created_at", fromTs(r.from)); if (r.to) q = q.lte("created_at", toTs(r.to)); return q; };
const dateFilter = (col: string, r: Range) => (q: any) => { if (r.from) q = q.gte(col, r.from); if (r.to) q = q.lte(col, r.to); return q; };

async function regMap(supabase: SupabaseClient): Promise<Map<string, string>> {
  const vs = await fetchAll(supabase, "vehicles");
  return new Map(vs.map((v) => [v.id, v.registration_number]));
}

function describeChange(r: any): string {
  if (r.action === "INSERT") return "Added";
  if (r.action === "DELETE") return "Deleted";
  const o = r.old_data || {}, n = r.new_data || {};
  return Object.keys(n).filter((k) => !SKIP_DIFF.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => `${k.replace(/_/g, " ")}: ${o[k] ?? ""} -> ${n[k] ?? ""}`).join("; ");
}

type Built = { headers: string[]; rows: Cell[][] };

async function build(supabase: SupabaseClient, key: ExportSectionKey, r: Range): Promise<Built> {
  switch (key) {
    case "cars": {
      const rows = (await fetchAll(supabase, "vehicles", tsFilter(r))).sort((a, b) => a.created_at.localeCompare(b.created_at));
      return {
        headers: ["Registration number", "Car name", "Make", "Model", "Year", "Fuel", "Transmission", "VIN", "Purchase date", "Status", "Fully sold at", "Added on"],
        rows: rows.map((v) => [v.registration_number, v.car_name, v.make, v.model, v.year, v.fuel_type, v.transmission, v.vin, v.purchase_date, v.status, ist(v.fully_sold_at), ist(v.created_at)]),
      };
    }
    case "parts": {
      const [parts, regs] = await Promise.all([fetchAll(supabase, "parts", tsFilter(r)), regMap(supabase)]);
      parts.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return {
        headers: ["Part ID", "Name", "Part number", "HSN/SAC", "Category", "Condition", "Quantity", "Status", "Expected price", "Minimum price", "Sold price", "Car registration", "Storage location", "Compatible models", "Notes", "Archived", "Added on"],
        rows: parts.map((p) => [p.id, p.name, p.part_number, p.hsn_sac, p.category, p.condition, p.quantity, p.status, p.expected_price, p.min_price, p.actual_price, p.vehicle_id ? regs.get(p.vehicle_id) ?? "" : "Loose part", p.storage_location, p.compatible_models, p.notes, p.archived ? "Yes" : "No", ist(p.created_at)]),
      };
    }
    case "photos": {
      const [media, regs] = await Promise.all([fetchAll(supabase, "media", tsFilter(r)), regMap(supabase)]);
      media.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return {
        headers: ["Type", "File path", "Part ID", "Car registration", "Added on"],
        rows: media.map((m) => [m.type, m.storage_path, m.part_id ?? "", m.vehicle_id ? regs.get(m.vehicle_id) ?? "" : "", ist(m.created_at)]),
      };
    }
    case "expenses": {
      const [ex, regs] = await Promise.all([fetchAll(supabase, "expenses", dateFilter("expense_date", r)), regMap(supabase)]);
      ex.sort((a, b) => a.expense_date.localeCompare(b.expense_date) || a.created_at.localeCompare(b.created_at));
      return {
        headers: ["Date", "Category", "Amount", "Car registration", "Note", "Added on"],
        rows: ex.map((e) => [e.expense_date, e.category, e.amount, e.vehicle_id ? regs.get(e.vehicle_id) ?? "" : "General", e.note, ist(e.created_at)]),
      };
    }
    case "invoices": {
      const [invs, items] = await Promise.all([fetchAll(supabase, "invoices", dateFilter("invoice_date", r)), fetchAll(supabase, "invoice_items")]);
      const totals = new Map<string, { taxable: number; gst: number }>();
      for (const it of items) {
        const t = totals.get(it.invoice_id) ?? { taxable: 0, gst: 0 };
        const base = Number(it.taxable_value) * Number(it.qty);
        t.taxable += base; t.gst += (base * Number(it.gst_percent)) / 100;
        totals.set(it.invoice_id, t);
      }
      invs.sort((a, b) => a.invoice_no.localeCompare(b.invoice_no));
      return {
        headers: ["Invoice no.", "Invoice date", "Buyer", "Phone", "GSTIN", "Buyer's vehicle", "Payment terms", "Due date", "Taxable value", "GST", "Invoice total", "Amount received", "Balance due", "Paid by", "Paid to", "Created on"],
        rows: invs.map((i) => {
          const t = totals.get(i.id) ?? { taxable: 0, gst: 0 };
          const total = round2(t.taxable + t.gst);
          return [i.invoice_no, i.invoice_date, i.buyer_name, i.buyer_phone, i.buyer_gstin, i.buyer_vehicle, i.payment_terms, i.due_date, round2(t.taxable), round2(t.gst), total, i.amount_received, round2(total - Number(i.amount_received)), i.payment_method, i.paid_to, ist(i.created_at)];
        }),
      };
    }
    case "invoice_lines": {
      const [invs, items] = await Promise.all([fetchAll(supabase, "invoices", dateFilter("invoice_date", r)), fetchAll(supabase, "invoice_items")]);
      const byId = new Map(invs.map((i) => [i.id, i]));
      const lines = items.filter((it) => byId.has(it.invoice_id)).sort((a, b) => byId.get(a.invoice_id).invoice_no.localeCompare(byId.get(b.invoice_id).invoice_no));
      return {
        headers: ["Invoice no.", "Invoice date", "Buyer", "Part ID", "Description", "Category", "HSN/SAC", "Quantity", "Taxable value (each)", "GST %", "GST amount", "Line total"],
        rows: lines.map((it) => {
          const inv = byId.get(it.invoice_id);
          const base = Number(it.taxable_value) * Number(it.qty);
          const gst = (base * Number(it.gst_percent)) / 100;
          return [inv.invoice_no, inv.invoice_date, inv.buyer_name, it.part_id, it.description, it.category, it.hsn_sac, it.qty, it.taxable_value, it.gst_percent, round2(gst), round2(base + gst)];
        }),
      };
    }
    case "activity": {
      const log = (await fetchAll(supabase, "activity_log", tsFilter(r))).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const TABLES: Record<string, string> = { vehicles: "Car", parts: "Part", invoices: "Invoice", invoice_items: "Invoice line", expenses: "Expense", media: "Photo/Video" };
      return {
        headers: ["When (India time)", "Who", "Action", "Record type", "Record", "What changed"],
        rows: log.map((l) => [ist(l.created_at), l.user_name, l.action === "INSERT" ? "Added" : l.action === "UPDATE" ? "Changed" : "Deleted", TABLES[l.table_name] ?? l.table_name, l.record_label, describeChange(l)]),
      };
    }
  }
}

export async function buildSection(supabase: SupabaseClient, key: ExportSectionKey, range: Range = {}, stamp = ""): Promise<SectionResult> {
  const { headers, rows } = await build(supabase, key, range);
  const label = EXPORT_SECTIONS.find((s) => s.key === key)!.key.replace(/_/g, "-");
  const span = range.from || range.to ? `_${range.from ?? "start"}_to_${range.to ?? "today"}` : "";
  return { key, filename: `parts-garage_${label}${span}${stamp ? "_" + stamp : ""}.csv`, csv: toCsv(headers, rows), rows: rows.length };
}
