// Minimal, Excel-friendly CSV writer.
export type Cell = string | number | boolean | null | undefined;

// A spreadsheet treats a cell that starts with = or @ (or +/- followed by a letter/symbol) as a formula.
// Text typed into the app is untrusted, so such cells are prefixed with an apostrophe to keep them as plain text.
// Phone numbers like "+91 98..." and negative numbers are left alone.
const looksLikeFormula = (s: string) => /^[=@\t\r]/.test(s) || /^[+-][^0-9 .()]/.test(s);

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "string" ? v : String(v);
  if (typeof v === "string" && looksLikeFormula(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// UTF-8 BOM so Excel shows ₹ and other characters correctly; CRLF line endings as Excel expects.
export function toCsv(headers: string[], rows: Cell[][]): string {
  return "\uFEFF" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
