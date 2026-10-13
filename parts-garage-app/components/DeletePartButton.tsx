"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Permanently deletes one part (and its photo records) after a confirmation step.
// The database refuses if the part is on an invoice — those must be archived instead.
export default function DeletePartButton({ partId, partName }: { partId: string; partName: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("delete_part", { p_id: partId });
    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }
    router.push("/parts");
    router.refresh();
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="yl-btn-ghost"
        style={{ color: "#E5484D", borderColor: "rgba(229,72,77,0.4)" }}
      >
        Delete this part…
      </button>
    );
  }

  return (
    <div style={{ background: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.3)", borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>
        Permanently delete “{partName}”?
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
        This removes the part and its photo records, and it can&apos;t be undone. The photo files stay in the storage bucket until you remove them in Backblaze.
        A part that has been on an invoice can&apos;t be deleted — archive it instead.
      </div>
      {error && <div style={{ fontSize: 12.5, color: "#E5484D", marginBottom: 12 }}>{error}</div>}
      <div className="yl-row yl-gap-2">
        <button
          onClick={handleDelete}
          disabled={busy}
          style={{ background: "#E5484D", color: "#fff", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 7, padding: "10px 14px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}
        >
          {busy ? "Deleting…" : "Yes, delete permanently"}
        </button>
        <button onClick={() => { setConfirming(false); setError(""); }} disabled={busy} className="yl-btn-ghost">Cancel</button>
      </div>
    </div>
  );
}
