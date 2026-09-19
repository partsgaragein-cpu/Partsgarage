import { createClient } from "@/lib/supabase/server";
import { PlateBadge } from "@/components/Badges";
import MediaGrid from "@/components/MediaGrid";
import PublicPartCard from "@/components/PublicPartCard";
import { PublicPart } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PublicGalleryPage({ params }: { params: { reg: string } }) {
  const supabase = createClient();
  const reg = decodeURIComponent(params.reg).toUpperCase();

  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("registration_number", reg).single();
  if (!vehicle) notFound();

  const [{ data: media }, { data: publicParts }] = await Promise.all([
    supabase.from("media").select("*").eq("vehicle_id", vehicle.id),
    supabase.from("parts_public").select("*").eq("vehicle_id", vehicle.id),
  ]);

  const parts = (publicParts || []) as PublicPart[];
  const partIds = parts.map((p) => p.id);
  const { data: partMedia } = partIds.length > 0
    ? await supabase.from("media").select("*").in("part_id", partIds)
    : { data: [] as any[] };

  const mediaByPart = new Map<string, any[]>();
  (partMedia || []).forEach((m) => {
    if (!mediaByPart.has(m.part_id)) mediaByPart.set(m.part_id, []);
    mediaByPart.get(m.part_id)!.push(m);
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-public)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px" }}>
        <div className="yl-row yl-items-center yl-justify-between" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)" }}>
            Parts Garage
          </div>
          <Link href="/inventory" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>View full inventory →</Link>
        </div>
        <PlateBadge reg={vehicle.registration_number} size="lg" />
        <div className="yl-display yl-fw-600" style={{ fontSize: 21, color: "var(--text)", marginTop: 12 }}>{vehicle.car_name}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 22 }}>
          {(media || []).length} photo/video item(s) — call to confirm current stock
        </div>

        <div style={{ marginBottom: 28 }}>
          <MediaGrid media={media} size="yl-grid-2" />
        </div>

        <h2 className="yl-section-label" style={{ marginBottom: 12, display: "block" }}>Parts Available ({parts.length})</h2>
        {parts.map((p) => (
          <PublicPartCard key={p.id} part={p} media={mediaByPart.get(p.id) || []} />
        ))}
        {parts.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13, marginBottom: 20 }}>No parts listed as available from this car right now.</div>}

        <div className="yl-card" style={{ marginTop: 24, padding: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Interested in a part?</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Reply on WhatsApp or call the garage directly to confirm price and availability.</div>
        </div>
      </div>
    </div>
  );
}
