import { createClient } from "@/lib/supabase/server";
import { VehicleCell, StatusBadge } from "@/components/Badges";
import { inr } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PartsPage({ searchParams }: { searchParams: { sold?: string } }) {
  const showSold = searchParams.sold === "1";
  const supabase = createClient();

  let query = supabase
    .from("parts")
    .select("*, vehicles(registration_number), media(id, type, storage_path)")
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (!showSold) query = query.neq("status", "Sold");

  const { data: parts } = await query;

  return (
    <div>
      <div className="yl-topbar">
        <h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Parts</h1>
        <Link href="/parts/new" className="yl-btn-primary">+ Add Part</Link>
      </div>
      <div className="yl-page">
        <div className="yl-row yl-gap-2" style={{ marginBottom: 14 }}>
          <Link href="/parts" className={showSold ? "yl-btn-ghost" : "yl-btn-primary"} style={{ textDecoration: "none" }}>Unsold</Link>
          <Link href="/parts?sold=1" className={showSold ? "yl-btn-primary" : "yl-btn-ghost"} style={{ textDecoration: "none" }}>Show Sold</Link>
        </div>
        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th></th><th>Part ID</th><th>Name</th><th>Vehicle</th><th>Category</th><th>Location</th><th>Expected</th><th>Actual</th><th>Status</th></tr></thead>
            <tbody>
              {(parts || []).map((p: any) => {
                const thumb = (p.media || [])[0];
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
                      <Link href={`/parts/${p.id}`} style={{ color: "var(--text)", textDecoration: "none" }}>{p.name}</Link>
                      <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{p.condition} · Qty {p.quantity}</div>
                    </td>
                    <td><VehicleCell reg={p.vehicles?.registration_number || null} /></td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.category}</td>
                    <td style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{p.storage_location}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{inr(p.expected_price)}</td>
                    <td style={{ fontSize: 12.5, color: p.actual_price ? "var(--whatsapp)" : "var(--text-faint)" }}>{p.actual_price ? inr(p.actual_price) : "—"}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                );
              })}
              {(!parts || parts.length === 0) && <tr><td colSpan={9} className="yl-empty">{showSold ? "No sold parts recorded yet." : "No unsold parts right now."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
