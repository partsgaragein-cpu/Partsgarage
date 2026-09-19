import { createClient } from "@/lib/supabase/server";
import { PlateBadge } from "@/components/Badges";
import PublicPartCard from "@/components/PublicPartCard";
import { PublicPart } from "@/lib/types";
import Link from "next/link";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: { view?: string } }) {
  const view = searchParams.view === "parts" ? "parts" : "cars";
  const supabase = createClient();

  // Everything customer-visible comes from parts_public: unsold rows only,
  // with min_price/actual_price already stripped at the database level.
  const { data: publicParts } = await supabase.from("parts_public").select("*");
  const allParts = (publicParts || []) as PublicPart[];

  const standaloneParts = allParts.filter((p) => !p.vehicle_id);
  const vehicleIds = Array.from(new Set(allParts.filter((p) => p.vehicle_id).map((p) => p.vehicle_id!)));

  const [{ data: vehicles }, { data: vehicleMedia }, { data: standaloneMedia }] = await Promise.all([
    vehicleIds.length > 0
      ? supabase.from("vehicles").select("*").in("id", vehicleIds)
      : Promise.resolve({ data: [] as any[] }),
    vehicleIds.length > 0
      ? supabase.from("media").select("*").in("vehicle_id", vehicleIds)
      : Promise.resolve({ data: [] as any[] }),
    standaloneParts.length > 0
      ? supabase.from("media").select("*").in("part_id", standaloneParts.map((p) => p.id))
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const mediaByVehicle = new Map<string, any[]>();
  (vehicleMedia || []).forEach((m) => {
    if (!mediaByVehicle.has(m.vehicle_id)) mediaByVehicle.set(m.vehicle_id, []);
    mediaByVehicle.get(m.vehicle_id)!.push(m);
  });

  const mediaByPart = new Map<string, any[]>();
  (standaloneMedia || []).forEach((m) => {
    if (!mediaByPart.has(m.part_id)) mediaByPart.set(m.part_id, []);
    mediaByPart.get(m.part_id)!.push(m);
  });

  const partCountByVehicle = new Map<string, number>();
  allParts.forEach((p) => {
    if (p.vehicle_id) partCountByVehicle.set(p.vehicle_id, (partCountByVehicle.get(p.vehicle_id) || 0) + 1);
  });

  const tabStyle = (active: boolean): CSSProperties => ({
    flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600,
    textDecoration: "none", background: active ? "var(--accent)" : "var(--surface-2)",
    color: active ? "var(--bg)" : "var(--text-muted)",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-public)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>
          Parts Garage
        </div>
        <div className="yl-display yl-fw-600" style={{ fontSize: 21, color: "var(--text)", marginBottom: 4 }}>Full Inventory</div>
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 20 }}>
          Everything currently in stock — call to confirm price and availability.
        </div>

        <div className="yl-row yl-gap-2" style={{ marginBottom: 22 }}>
          <Link href="/inventory?view=cars" style={tabStyle(view === "cars")}>Cars ({vehicles?.length || 0})</Link>
          <Link href="/inventory?view=parts" style={tabStyle(view === "parts")}>Standalone Parts ({standaloneParts.length})</Link>
        </div>

        {view === "cars" ? (
          <div>
            {(vehicles || []).map((v) => {
              const thumb = (mediaByVehicle.get(v.id) || [])[0];
              return (
                <Link key={v.id} href={`/car/${v.registration_number}`} style={{ textDecoration: "none" }}>
                  <div className="yl-card yl-row yl-items-center yl-gap-3" style={{ padding: 12, marginBottom: 10 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {thumb ? (
                        thumb.type === "video" ? (
                          <video src={thumb.storage_path} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb.storage_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )
                      ) : (
                        <span style={{ fontSize: 9, color: "var(--text-faint)" }}>No photo</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <PlateBadge reg={v.registration_number} />
                      <div style={{ fontSize: 13.5, color: "var(--text)", marginTop: 4 }}>{v.car_name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{partCountByVehicle.get(v.id) || 0} part(s) available</div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {(!vehicles || vehicles.length === 0) && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No cars with unsold parts right now.</div>}
          </div>
        ) : (
          <div>
            {standaloneParts.map((p) => (
              <PublicPartCard key={p.id} part={p} media={mediaByPart.get(p.id) || []} />
            ))}
            {standaloneParts.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No standalone parts in stock right now.</div>}
          </div>
        )}

        <div className="yl-card" style={{ marginTop: 24, padding: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Interested in a part?</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Reply on WhatsApp or call the garage directly to confirm price and availability.</div>
        </div>
      </div>
    </div>
  );
}
