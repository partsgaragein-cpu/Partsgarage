// Search used on the customer inventory page.
//
// Every word the customer types must be found somewhere in the item's text
// (words can match different fields, so "swift bumper" finds the bumper of a
// Swift). Matching ignores capitals, and also ignores spaces/dashes so
// "mp09 ab 1234" still finds registration MP09AB1234.

export const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function parseQuery(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
}

export function matchesAll(words: string[], ...fields: (string | number | null | undefined)[]): boolean {
  if (words.length === 0) return true;
  const hay = fields.filter((f) => f !== null && f !== undefined && f !== "").join(" ").toLowerCase();
  const squashed = squash(hay);
  return words.every((w) => {
    if (hay.includes(w)) return true;
    const sw = squash(w);
    return sw.length > 0 && squashed.includes(sw);
  });
}
