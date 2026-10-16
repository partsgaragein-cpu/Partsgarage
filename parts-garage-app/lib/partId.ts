import type { SupabaseClient } from "@supabase/supabase-js";

// Part IDs look like PG-1234-ENG-007: the last 4 characters of the car's
// registration (or LOOSE for a standalone part), the first 3 letters of the
// category, then a running number for that combination.
export function partIdPrefix(reg: string | null, category: string): string {
  const car = reg ? reg.slice(-4) : "LOOSE";
  return `PG-${car}-${category.slice(0, 3).toUpperCase()}-`;
}

// Next free number for a prefix = (highest number already used) + 1.
// Counting rows instead goes wrong as soon as any part has been deleted: the
// count drops, and the "next" number can already belong to an existing part.
export async function nextPartId(supabase: SupabaseClient, prefix: string): Promise<string> {
  const { data, error } = await supabase.from("parts").select("id").like("id", `${prefix}%`);
  if (error) throw new Error(`Could not work out the next part number: ${error.message}`);
  let max = 0;
  for (const row of data || []) {
    const n = parseInt(String(row.id).slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

// Saves a new part under the next free ID and returns that ID. If two people save
// at the same moment and pick the same number, the database rejects the second
// one (IDs are unique) and we simply pick the next number and try again.
// Any other failure throws a readable Error — it is never swallowed.
export async function insertPart(supabase: SupabaseClient, prefix: string, row: Record<string, unknown>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = await nextPartId(supabase, prefix);
    const { error } = await supabase.from("parts").insert({ id, ...row });
    if (!error) return id;
    if (error.code === "23505") continue; // that number was just taken — try the next one
    throw new Error(`Could not save the part: ${error.message}`);
  }
  throw new Error("Could not find a free part number. Please try again.");
}
