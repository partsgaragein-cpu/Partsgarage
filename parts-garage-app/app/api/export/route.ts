import { NextRequest, NextResponse } from "next/server";
import { zipSync, strToU8 } from "fflate";
import { createClient } from "@/lib/supabase/server";
import { buildSection } from "@/lib/exportData";
import { EXPORT_SECTIONS, ExportSectionKey } from "@/lib/exportSections";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (s: string) => DATE.test(s) && !Number.isNaN(Date.parse(s));
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" });

// GET /api/export?section=<cars|parts|photos|expenses|invoices|invoice_lines|activity|all>&from=YYYY-MM-DD&to=YYYY-MM-DD
// Only for signed-in users. "all" ignores the dates and returns a ZIP with one CSV per section.
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const section = p.get("section") ?? "";
  const from = p.get("from") || undefined;
  const to = p.get("to") || undefined;
  if ((from && !isValidDate(from)) || (to && !isValidDate(to))) return NextResponse.json({ error: "Dates must look like 2026-10-31." }, { status: 400 });
  if (from && to && from > to) return NextResponse.json({ error: "The 'From' date is after the 'To' date." }, { status: 400 });

  try {
    if (section === "all") {
      const stamp = today();
      const results = [];
      for (const s of EXPORT_SECTIONS) results.push(await buildSection(supabase, s.key, {}, ""));
      const readme = [
        "Parts Garage - full data export",
        `Exported on ${stamp} (India time) by ${user.email ?? "a signed-in user"}`,
        "",
        ...results.map((r) => `${r.filename}: ${r.rows} row(s)`),
        "",
        "Open the .csv files in Excel or Google Sheets. This export is for reading and for your accountant;",
        "it is not the backup format used to restore the system.",
      ].join("\r\n");
      const files: Record<string, Uint8Array> = { "README.txt": strToU8(readme) };
      for (const r of results) files[r.filename] = strToU8(r.csv);
      const zip = zipSync(files);
      return new NextResponse(zip, {
        headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="parts-garage-export_${stamp}.zip"`, "Cache-Control": "no-store" },
      });
    }

    if (!EXPORT_SECTIONS.some((s) => s.key === section)) return NextResponse.json({ error: "Unknown section." }, { status: 400 });
    const r = await buildSection(supabase, section as ExportSectionKey, { from, to }, from || to ? "" : today());
    return new NextResponse(r.csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${r.filename}"`, "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Export failed: ${e?.message ?? "unknown error"}` }, { status: 500 });
  }
}
