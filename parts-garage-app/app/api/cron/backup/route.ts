import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { putObject } from "@/lib/storage";

// Every table that has to survive a "someone fat-fingered a delete" day.
// Each entry: table name + the column used to keep paging order stable.
const TABLES: { name: string; orderBy: string }[] = [
  { name: "vehicles", orderBy: "id" },
  { name: "media", orderBy: "id" },
  { name: "parts", orderBy: "id" },
  { name: "expenses", orderBy: "id" },
  { name: "invoices", orderBy: "id" },
  { name: "invoice_items", orderBy: "id" },
  { name: "activity_log", orderBy: "id" },
  { name: "profiles", orderBy: "user_id" },
];

// Supabase returns at most 1,000 rows per request and does NOT warn when it cuts a result off,
// so every table is read in pages until a page comes back short.
const PAGE_SIZE = 1000;

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Vercel Cron sends this exact header on every scheduled call. Checking it
  // stops anyone who finds the URL from triggering (or spamming) backups.
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Service role key on purpose: this route has no logged-in user (it's a
  // server calling itself), so the anon key + RLS would return nothing.
  // This key must NEVER be prefixed NEXT_PUBLIC_ or sent to the browser.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const backup: Record<string, unknown> = { taken_at: new Date().toISOString() };
  const errors: string[] = [];

  for (const { name, orderBy } of TABLES) {
    const rows: unknown[] = [];
    let failed = false;
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase.from(name).select("*").order(orderBy).range(from, from + PAGE_SIZE - 1);
      if (error) {
        errors.push(`${name}: ${error.message}`);
        failed = true;
        break;
      }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    if (failed) continue;

    // Safety check: the number of rows saved must equal the number of rows in the table.
    const { count, error: countError } = await supabase.from(name).select("*", { count: "exact", head: true });
    if (countError) {
      errors.push(`${name}: could not verify row count (${countError.message})`);
      continue;
    }
    if (count !== null && count !== rows.length) {
      errors.push(`${name}: saved ${rows.length} rows but the table has ${count}`);
      continue;
    }
    backup[name] = rows;
  }

  // If any table failed to read, don't upload a half-complete backup and
  // call it a success — better to fail loudly here and retry tomorrow.
  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: "Backup incomplete", details: errors },
      { status: 500 }
    );
  }

  // One new file per day, named by date. Nothing is ever deleted or
  // overwritten here — every day's backup stays in the (private) bucket permanently.
  const dateStr = new Date().toISOString().split("T")[0]; // e.g. 2026-09-04
  const key = `backups/${dateStr}.json`;

  await putObject(key, JSON.stringify(backup), "application/json");

  return NextResponse.json({
    ok: true,
    backed_up: key,
    row_counts: Object.fromEntries(
      TABLES.map((t) => [t.name, (backup[t.name] as unknown[] | undefined)?.length ?? 0])
    ),
  });
}
