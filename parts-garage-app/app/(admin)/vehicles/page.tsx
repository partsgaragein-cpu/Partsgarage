import { createClient } from "@/lib/supabase/server";
import { PlateBadge, StatusBadge } from "@/components/Badges";
import ShareInventoryButton from "@/components/ShareInventoryButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const supabase = createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });

  return (
    <div>
      <div className="yl-topbar">
        <h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Vehicles</h1>
        <div className="yl-row yl-gap-2">
          <ShareInventoryButton />
          <Link href="/vehicles/new" className="yl-btn-primary">+ Register New Car</Link>
        </div>
      </div>
      <div className="yl-page">
        <div className="yl-card yl-table-wrap">
          <table className="yl-table">
            <thead><tr><th>Registration</th><th>Vehicle</th><th>Status</th><th>Added</th></tr></thead>
            <tbody>
              {(vehicles || []).map((vh) => (
                <tr key={vh.id} className="yl-tr">
                  <td><Link href={`/vehicles/${vh.registration_number}`} style={{ textDecoration: "none" }}><PlateBadge reg={vh.registration_number} /></Link></td>
                  <td style={{ color: "var(--text)" }}>{vh.car_name}<div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{vh.year}</div></td>
                  <td><StatusBadge status={vh.status} /></td>
                  <td style={{ color: "var(--text-faint)", fontSize: 12 }}>{new Date(vh.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!vehicles || vehicles.length === 0) && <tr><td colSpan={4} className="yl-empty">No vehicles yet — register your first car.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
