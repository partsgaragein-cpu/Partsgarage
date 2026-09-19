import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from "@/lib/r2";

// Every table that has to survive a "someone fat-fingered a delete" day.
const TABLES = [
  "vehicles",
  "media",
  "parts",
  "expenses",
  "invoices",
  "invoice_items",
] as const;

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

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      errors.push(`${table}: ${error.message}`);
      continue;
    }
    backup[table] = data;
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
  // overwritten here — every day's backup stays in R2 permanently.
  const dateStr = new Date().toISOString().split("T")[0]; // e.g. 2026-09-04
  const key = `backups/${dateStr}.json`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: JSON.stringify(backup, null, 2),
      ContentType: "application/json",
    })
  );

  return NextResponse.json({
    ok: true,
    backed_up: key,
    row_counts: Object.fromEntries(
      TABLES.map((t) => [t, (backup[t] as unknown[] | undefined)?.length ?? 0])
    ),
  });
}
