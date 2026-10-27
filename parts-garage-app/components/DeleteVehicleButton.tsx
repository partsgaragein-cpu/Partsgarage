"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Permanently deletes a car, its parts, photo records and expenses after a confirmation step.
// The database refuses if any of its parts is on an invoice (delete those invoices first).
export default function DeleteVehicleButton({ vehicleId, reg }: { vehicleId: string; reg: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("delete_vehicle", { p_id: vehicleId });
    if (rpcError) { setError(rpcError.message); setBusy(false); return; }
    router.push("/vehicles");
    router.refresh();
  };

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="yl-btn-ghost" style={{ color: "#E5484D", borderColor: "rgba(229,72,77,0.4)" }}>
        Delete this car…
      </button>
    );
  }

  return (
    <div style={{ background: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.3)", borderRadius: 8, padding: "14px 16px", maxWidth: 520 }}>
      <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>Permanently delete {reg} and everything on it?</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
        This removes the car with all its parts, photo records and expenses. It can&apos;t be undone, and the photo files stay in the storage bucket until you remove them in Backblaze. A car with parts on an invoice can&apos;t be deleted until those invoices are deleted. A record of the deletion stays in Activity.
      </div>
      {error && <div style={{ fontSize: 12.5, color: "#E5484D", marginBottom: 12 }}>{error}</div>}
      <div className="yl-row yl-gap-2">
        <button onClick={handleDelete} disabled={busy} style={{ background: "#E5484D", color: "#fff", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 7, padding: "10px 14px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Deleting…" : "Yes, delete permanently"}
        </button>
        <button onClick={() => { setConfirming(false); setError(""); }} disabled={busy} className="yl-btn-ghost">Cancel</button>
      </div>
    </div>
  );
}
