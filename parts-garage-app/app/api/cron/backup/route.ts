import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headObject, putObject } from "@/lib/storage";

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

// Temporary hiccups (a network blip, a busy database, a slow storage call) are retried a few times
// before the night is declared failed. Delays are short so the whole job stays inside maxDuration.
const ATTEMPTS = 3;
const RETRY_DELAY_MS = Number(process.env.BACKUP_RETRY_DELAY_MS ?? 2000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`Backup: ${label} failed (attempt ${attempt}/${ATTEMPTS}):`, err instanceof Error ? err.message : err);
      if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}

// Heartbeat to a monitoring service (e.g. Healthchecks.io). It emails you if a night is missed or reported
// as failed. Optional: does nothing unless HEALTHCHECK_URL is set, and a ping problem never breaks the backup.
async function ping(ok: boolean): Promise<void> {
  const url = process.env.HEALTHCHECK_URL;
  if (!url) return;
  try {
    await fetch(ok ? url : `${url.replace(/\/+$/, "")}/fail`, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    console.error("Backup: could not reach the heartbeat service:", err instanceof Error ? err.message : err);
  }
}

type Backup = Record<string, unknown>;

async function readEverything(supabase: any): Promise<Backup> {
  const backup: Backup = { taken_at: new Date().toISOString() };
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

  // Never hand back a half-complete backup: a failure here makes the caller retry.
  if (errors.length > 0) throw new Error(`Backup incomplete: ${errors.join("; ")}`);
  return backup;
}

// Uploads the file, then asks the bucket for it again and checks it is really there at the right size.
async function uploadAndVerify(key: string, body: string): Promise<number> {
  const expected = Buffer.byteLength(body, "utf8");
  await putObject(key, body, "application/json");
  const stored = await headObject(key);
  if (!stored) throw new Error(`Uploaded ${key} but it was not found in the bucket afterwards`);
  if (stored.size !== expected) throw new Error(`Uploaded ${key} but the stored size (${stored.size} bytes) differs from what was sent (${expected} bytes)`);
  return expected;
}

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
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const backup = await withRetry("reading the database", () => readEverything(supabase));

    // One new file per day, named by date. Nothing is ever deleted or
    // overwritten here — every day's backup stays in the (private) bucket permanently.
    const dateStr = new Date().toISOString().split("T")[0]; // e.g. 2026-09-04
    const key = `backups/${dateStr}.json`;
    const body = JSON.stringify(backup);

    const bytes = await withRetry("uploading and verifying the file", () => uploadAndVerify(key, body));

    // Only now is the night counted as a success.
    await ping(true);
    return NextResponse.json({
      ok: true,
      verified: true,
      backed_up: key,
      bytes,
      row_counts: Object.fromEntries(TABLES.map((t) => [t.name, (backup[t.name] as unknown[] | undefined)?.length ?? 0])),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Backup FAILED:", message);
    await ping(false);
    return NextResponse.json({ ok: false, error: "Backup failed", details: [message] }, { status: 500 });
  }
}
