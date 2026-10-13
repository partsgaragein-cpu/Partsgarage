import { createClient } from "@/lib/supabase/server";
import { PlateBadge } from "@/components/Badges";
import PublicPartCard from "@/components/PublicPartCard";
import { signMedia } from "@/lib/storage";
import { matchesAll, parseQuery } from "@/lib/search";
import { PublicPart } from "@/lib/types";
import Link from "next/link";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

const MAX_PART_RESULTS = 60;

export default async function InventoryPage({ searchParams }: { searchParams: { view?: string; q?: string } }) {
  const q = (searchParams.q || "").trim().slice(0, 100);
  const words = parseQuery(q);
  const searching = words.length > 0;
  const view = searchParams.view === "parts" ? "parts" : "cars";
  const supabase = createClient();

  // Everything customer-visible comes from parts_public: unsold rows only,
  // with min_price/actual_price already stripped at the database level.
  const { data: publicParts } = await supabase.from("parts_public").select("*");
  const allParts = (publicParts || []) as PublicPart[];

  const standaloneParts = allParts.filter((p) => !p.vehicle_id);
  const vehicleIds = Array.from(new Set(allParts.filter((p) => p.vehicle_id).map((p) => p.vehicle_id!)));

  const { data: vehicleRows } = vehicleIds.length > 0
    ? await supabase.from("vehicles").select("*").in("id", vehicleIds)
    : { data: [] as any[] };
  const vehicles = (vehicleRows || []) as any[];
  const vehById = new Map(vehicles.map((v) => [v.id, v]));

  // --- search (done here in code, so what the customer types never goes into a database query) ---
  const carFields = (v: any) => [v.car_name, v.registration_number, v.make, v.model, v.year, v.fuel_type, v.transmission];
  const matchedCars = searching ? vehicles.filter((v) => matchesAll(words, ...carFields(v))) : [];
  const matchedParts = searching
    ? allParts.filter((p) => {
        const v = p.vehicle_id ? vehById.get(p.vehicle_id) : null;
        return matchesAll(words, p.name, p.part_number, p.category, p.condition, p.compatible_models, ...(v ? carFields(v) : []));
      })
    : [];
  const shownParts = matchedParts.slice(0, MAX_PART_RESULTS);

  // Photos needed: every car's cover photo, plus the parts that are actually going to be shown.
  const partIdsForMedia = searching ? shownParts.map((p) => p.id) : standaloneParts.map((p) => p.id);
  const [{ data: vehicleMediaRaw }, { data: partMediaRaw }] = await Promise.all([
    vehicleIds.length > 0
      ? supabase.from("media").select("*").in("vehicle_id", vehicleIds)
      : Promise.resolve({ data: [] as any[] }),
    partIdsForMedia.length > 0
      ? supabase.from("media").select("*").in("part_id", partIdsForMedia)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Media is stored as bucket keys; swap each for a temporary signed link before rendering.
  const vehicleMedia = await signMedia(vehicleMediaRaw);
  const partMedia = await signMedia(partMediaRaw);

  const mediaByVehicle = new Map<string, any[]>();
  vehicleMedia.forEach((m: any) => {
    if (!mediaByVehicle.has(m.vehicle_id)) mediaByVehicle.set(m.vehicle_id, []);
    mediaByVehicle.get(m.vehicle_id)!.push(m);
  });

  const mediaByPart = new Map<string, any[]>();
  partMedia.forEach((m: any) => {
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

  const carCard = (v: any) => {
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
  };

  // Small line above a search-result part saying which car it comes from (tap to open that car).
  const ownerLine = (p: PublicPart) => {
    const v = p.vehicle_id ? vehById.get(p.vehicle_id) : null;
    return v ? (
      <Link href={`/car/${v.registration_number}`} className="yl-row yl-items-center yl-gap-2" style={{ textDecoration: "none", marginBottom: 6 }}>
        <PlateBadge reg={v.registration_number} />
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{v.car_name} →</span>
      </Link>
    ) : (
      <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 6 }}>Standalone part (not from a listed car)</div>
    );
  };

  const sectionLabel: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", margin: "18px 0 10px" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-public)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>
          Parts Garage
        </div>
        <div className="yl-display yl-fw-600" style={{ fontSize: 21, color: "var(--text)", marginBottom: 4 }}>Full Inventory</div>
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 16 }}>
          Everything currently in stock — call to confirm price and availability.
        </div>

        <form action="/inventory" method="GET" className="yl-row yl-gap-2" style={{ marginBottom: 18 }}>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search car, part or part number…"
            aria-label="Search the inventory"
            className="yl-input"
            style={{ flex: 1, fontSize: 16, padding: "11px 12px" }}
          />
          <button type="submit" className="yl-btn-primary">Search</button>
        </form>

        {searching ? (
          <div>
            <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 4 }}>
              {matchedCars.length + matchedParts.length} result(s) for “{q}” ·{" "}
              <Link href="/inventory" style={{ color: "var(--accent)", textDecoration: "none" }}>Clear search</Link>
            </div>

            {matchedCars.length > 0 && (
              <>
                <div style={sectionLabel}>Cars ({matchedCars.length})</div>
                {matchedCars.map(carCard)}
              </>
            )}

            {shownParts.length > 0 && (
              <>
                <div style={sectionLabel}>Parts ({matchedParts.length})</div>
                {shownParts.map((p) => (
                  <div key={p.id}>
                    {ownerLine(p)}
                    <PublicPartCard part={p} media={mediaByPart.get(p.id) || []} />
                  </div>
                ))}
                {matchedParts.length > shownParts.length && (
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 12 }}>
                    Showing the first {shownParts.length} parts — add another word to narrow it down.
                  </div>
                )}
              </>
            )}

            {matchedCars.length === 0 && matchedParts.length === 0 && (
              <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "16px 0" }}>
                Nothing matched “{q}”. Try fewer or shorter words — for example just the car name or the part name.
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="yl-row yl-gap-2" style={{ marginBottom: 22 }}>
              <Link href="/inventory?view=cars" style={tabStyle(view === "cars")}>Cars ({vehicles.length})</Link>
              <Link href="/inventory?view=parts" style={tabStyle(view === "parts")}>Standalone Parts ({standaloneParts.length})</Link>
            </div>

            {view === "cars" ? (
              <div>
                {vehicles.map(carCard)}
                {vehicles.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No cars with unsold parts right now.</div>}
              </div>
            ) : (
              <div>
                {standaloneParts.map((p) => (
                  <PublicPartCard key={p.id} part={p} media={mediaByPart.get(p.id) || []} />
                ))}
                {standaloneParts.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No standalone parts in stock right now.</div>}
              </div>
            )}
          </>
        )}

        <div className="yl-card" style={{ marginTop: 24, padding: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Interested in a part?</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Reply on WhatsApp or call the garage directly to confirm price and availability.</div>
        </div>
      </div>
    </div>
  );
}
