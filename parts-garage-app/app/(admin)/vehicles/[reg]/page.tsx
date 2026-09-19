import { createClient } from "@/lib/supabase/server";
import { PlateBadge, StatusBadge, VehicleCell } from "@/components/Badges";
import { inr } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import ShareButton from "./ShareButton";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({ params }: { params: { reg: string } }) {
  const supabase = createClient();
  const reg = decodeURIComponent(params.reg).toUpperCase();

  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("registration_number", reg).single();
  if (!vehicle) notFound();

  const [{ data: media }, { data: parts }, { data: expenses }] = await Promise.all([
    supabase.from("media").select("*").eq("vehicle_id", vehicle.id),
    supabase.from("parts").select("*").eq("vehicle_id", vehicle.id).eq("archived", false),
    supabase.from("expenses").select("*").eq("vehicle_id", vehicle.id),
  ]);

  const investment = (expenses || []).reduce((s, e) => s + e.amount, 0);
  const revenue = (parts || []).filter((p) => p.status === "Sold").reduce((s, p) => s + (p.actual_price || 0), 0);

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>{vehicle.car_name}</h1></div>
      <div className="yl-page">
        <Link href="/vehicles" className="yl-link-btn" style={{ display: "inline-block", marginBottom: 16 }}>← Back to vehicles</Link>

        <div className="yl-card" style={{ padding: "20px 22px", marginBottom: 16 }}>
          <div className="yl-row yl-items-center yl-justify-between" style={{ flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
            <div>
              <PlateBadge reg={vehicle.registration_number} size="lg" />
              <div className="yl-display yl-fw-600" style={{ fontSize: 19, color: "var(--text)", marginTop: 10 }}>{vehicle.car_name}</div>
              <div className="yl-row yl-items-center yl-gap-2" style={{ marginTop: 5 }}>
                <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{vehicle.year}</span>
                <StatusBadge status={vehicle.status} />
              </div>
            </div>
            <ShareButton reg={vehicle.registration_number} name={vehicle.car_name} />
          </div>
          <div className="yl-grid-3" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div><div className="yl-mini-label">Investment</div><div className="yl-display yl-fw-600" style={{ fontSize: 17, color: "var(--text)" }}>{inr(investment)}</div></div>
            <div><div className="yl-mini-label">Revenue Recovered</div><div className="yl-display yl-fw-600" style={{ fontSize: 17, color: "var(--whatsapp)" }}>{inr(revenue)}</div></div>
            <div><div className="yl-mini-label">Remaining Recovery</div><div className="yl-display yl-fw-600" style={{ fontSize: 17 }}>{inr(Math.max(investment - revenue, 0))}</div></div>
          </div>
        </div>

        <h2 className="yl-section-label" style={{ marginBottom: 12, display: "block" }}>Media ({(media || []).length})</h2>
        <div className="yl-grid-4" style={{ marginBottom: 24 }}>
          {(media || []).map((m) => (
            <div key={m.id} className="yl-media-card">
              {m.type === "video" ? (
                <video src={m.storage_path} controls style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.storage_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
              )}
            </div>
          ))}
          {(!media || media.length === 0) && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No media uploaded yet.</div>}
        </div>

        <div className="yl-row yl-items-center yl-justify-between" style={{ marginBottom: 12 }}>
          <h2 className="yl-section-label">Parts from this Vehicle ({(parts || []).length})</h2>
          <Link href={`/parts/new?vehicle=${vehicle.registration_number}`} className="yl-link-btn">+ Add part</Link>
        </div>
        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th>Part ID</th><th>Name</th><th>Category</th><th>Expected</th><th>Actual</th><th>Status</th></tr></thead>
            <tbody>
              {(parts || []).map((p) => (
                <tr key={p.id} className="yl-tr">
                  <td className="yl-mono" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{p.id}</td>
                  <td style={{ color: "var(--text)" }}>{p.name}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.category}</td>
                  <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{inr(p.expected_price)}</td>
                  <td style={{ fontSize: 12.5, color: p.actual_price ? "var(--whatsapp)" : "var(--text-faint)" }}>{p.actual_price ? inr(p.actual_price) : "—"}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {(!parts || parts.length === 0) && <tr><td colSpan={6} className="yl-empty">No parts recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
