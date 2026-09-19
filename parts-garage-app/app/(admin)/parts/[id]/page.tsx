import { createClient } from "@/lib/supabase/server";
import { StatusBadge, VehicleCell } from "@/components/Badges";
import MediaGrid from "@/components/MediaGrid";
import { inr } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddPartMedia from "./AddPartMedia";

export const dynamic = "force-dynamic";

export default async function PartDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const id = decodeURIComponent(params.id);

  const { data: part } = await supabase
    .from("parts")
    .select("*, vehicles(registration_number, car_name)")
    .eq("id", id)
    .single();
  if (!part) notFound();

  const { data: media } = await supabase.from("media").select("*").eq("part_id", id);

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>{part.name}</h1></div>
      <div className="yl-page" style={{ maxWidth: 720 }}>
        <Link href="/parts" className="yl-link-btn" style={{ display: "inline-block", marginBottom: 16 }}>← Back to parts</Link>

        <div className="yl-card" style={{ padding: "20px 22px", marginBottom: 20 }}>
          <div className="yl-row yl-items-center yl-justify-between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div>
              <div className="yl-mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{part.id}</div>
              <div className="yl-display yl-fw-600" style={{ fontSize: 19, color: "var(--text)", marginTop: 4 }}>{part.name}</div>
            </div>
            <StatusBadge status={part.status} />
          </div>

          <div className="yl-grid-3" style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
            <div><div className="yl-mini-label">Vehicle</div><VehicleCell reg={part.vehicles?.registration_number || null} /></div>
            <div><div className="yl-mini-label">Category</div><div style={{ fontSize: 13, color: "var(--text)" }}>{part.category}</div></div>
            <div><div className="yl-mini-label">Condition</div><div style={{ fontSize: 13, color: "var(--text)" }}>{part.condition}</div></div>
            <div><div className="yl-mini-label">Quantity</div><div style={{ fontSize: 13, color: "var(--text)" }}>{part.quantity}</div></div>
            <div><div className="yl-mini-label">Expected Price</div><div style={{ fontSize: 13, color: "var(--text)" }}>{inr(part.expected_price)}</div></div>
            <div><div className="yl-mini-label">Actual Price</div><div style={{ fontSize: 13, color: part.actual_price ? "var(--whatsapp)" : "var(--text-faint)" }}>{part.actual_price ? inr(part.actual_price) : "—"}</div></div>
            <div><div className="yl-mini-label">Storage Location</div><div style={{ fontSize: 13, color: "var(--text)" }}>{part.storage_location || "—"}</div></div>
            <div><div className="yl-mini-label">Part Number</div><div className="yl-mono" style={{ fontSize: 12.5, color: "var(--text)" }}>{part.part_number || "—"}</div></div>
            <div><div className="yl-mini-label">Min Price</div><div style={{ fontSize: 13, color: "var(--text)" }}>{part.min_price ? inr(part.min_price) : "—"}</div></div>
          </div>

          {part.notes && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div className="yl-mini-label" style={{ marginBottom: 4 }}>Notes / Defects</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{part.notes}</div>
            </div>
          )}
        </div>

        <h2 className="yl-section-label" style={{ marginBottom: 12, display: "block" }}>Media ({(media || []).length})</h2>
        <MediaGrid media={media} />
        <AddPartMedia partId={part.id} />
      </div>
    </div>
  );
}
