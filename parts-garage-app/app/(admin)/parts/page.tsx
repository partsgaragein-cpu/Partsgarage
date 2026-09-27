import { createClient } from "@/lib/supabase/server";
import { VehicleCell, StatusBadge } from "@/components/Badges";
import ArchivePartButton from "@/components/ArchivePartButton";
import { inr, isPriorityPart } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PartsPage({ searchParams }: { searchParams: { sold?: string; archived?: string; q?: string } }) {
  const showSold = searchParams.sold === "1";
  const showArchived = searchParams.archived === "1";
  const q = (searchParams.q || "").trim();
  const supabase = createClient();

  let vehicleIds: string[] = [];
  if (q) {
    const { data: matchedVehicles } = await supabase.from("vehicles").select("id").ilike("registration_number", `%${q}%`);
    vehicleIds = (matchedVehicles || []).map((v) => v.id);
  }

  let query = supabase
    .from("parts")
    .select("*, vehicles(registration_number), media(id, type, storage_path)")
    .eq("archived", showArchived)
    .order("created_at", { ascending: false });

  if (!showArchived && !showSold) query = query.neq("status", "Sold");

  if (q) {
    const orParts = [`name.ilike.%${q}%`, `id.ilike.%${q}%`, `part_number.ilike.%${q}%`];
    if (vehicleIds.length > 0) orParts.push(`vehicle_id.in.(${vehicleIds.join(",")})`);
    query = query.or(orParts.join(","));
  }

  const { data: parts } = await query;

  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (showSold) params.set("sold", "1");
    if (showArchived) params.set("archived", "1");
    Object.entries(overrides).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    const str = params.toString();
    return str ? `/parts?${str}` : "/parts";
  };

  return (
    <div>
      <div className="yl-topbar">
        <h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)" }}>Parts</h1>
        <Link href="/parts/new" className="yl-btn-primary">+ Add Part</Link>
      </div>
      <div className="yl-page">
        <div className="yl-row yl-gap-3" style={{ marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div className="yl-row yl-gap-2">
            <Link href={qs({ archived: "" })} className={showArchived ? "yl-btn-ghost" : "yl-btn-primary"} style={{ textDecoration: "none" }}>Active</Link>
            <Link href={qs({ archived: "1" })} className={showArchived ? "yl-btn-primary" : "yl-btn-ghost"} style={{ textDecoration: "none" }}>Archived</Link>
          </div>
          {!showArchived && (
            <div className="yl-row yl-gap-2">
              <Link href={qs({ sold: "" })} className={showSold ? "yl-btn-ghost" : "yl-btn-primary"} style={{ textDecoration: "none", fontSize: 12, padding: "8px 12px" }}>Unsold</Link>
              <Link href={qs({ sold: "1" })} className={showSold ? "yl-btn-primary" : "yl-btn-ghost"} style={{ textDecoration: "none", fontSize: 12, padding: "8px 12px" }}>Show Sold</Link>
            </div>
          )}
          <form action="/parts" method="GET" className="yl-row yl-gap-2" style={{ marginLeft: "auto", flex: "1 1 200px", maxWidth: 320 }}>
            {showSold && <input type="hidden" name="sold" value="1" />}
            {showArchived && <input type="hidden" name="archived" value="1" />}
            <input name="q" defaultValue={q} placeholder="Search part, ID, or vehicle reg…" className="yl-input" style={{ width: "100%" }} />
          </form>
        </div>

        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th></th><th>Part ID</th><th>Name</th><th>Vehicle</th><th>Category</th><th>Location</th><th>Expected</th><th>Actual</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(parts || []).map((p: any) => {
                const thumb = (p.media || [])[0];
                const priority = isPriorityPart(p.name, p.category);
                return (
                  <tr key={p.id} className="yl-tr">
                    <td>
                      <Link href={`/parts/${p.id}`}>
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {thumb ? (
                            thumb.type === "video" ? (
                              <video src={thumb.storage_path} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb.storage_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            )
                          ) : (
                            <span style={{ fontSize: 9, color: "var(--text-faint)" }}>—</span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="yl-mono" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      <Link href={`/parts/${p.id}`} style={{ color: "inherit", textDecoration: "none" }}>{p.id}</Link>
                    </td>
                    <td>
                      <Link href={`/parts/${p.id}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                        {priority && <span title="Priority part" style={{ color: "var(--accent)", marginRight: 4 }}>★</span>}
                        {p.name}
                      </Link>
                      <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{p.condition} · Qty {p.quantity}{p.part_number ? ` · ${p.part_number}` : ""}</div>
                    </td>
                    <td><VehicleCell reg={p.vehicles?.registration_number || null} /></td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.category}</td>
                    <td style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{p.storage_location}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{inr(p.expected_price)}</td>
                    <td style={{ fontSize: 12.5, color: p.actual_price ? "var(--whatsapp)" : "var(--text-faint)" }}>{p.actual_price ? inr(p.actual_price) : "—"}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td><ArchivePartButton partId={p.id} archived={showArchived} /></td>
                  </tr>
                );
              })}
              {(!parts || parts.length === 0) && (
                <tr><td colSpan={10} className="yl-empty">
                  {showArchived ? "No archived parts." : showSold ? "No sold parts recorded yet." : "No unsold parts right now."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
