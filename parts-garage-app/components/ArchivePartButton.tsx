"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ArchivePartButton({ partId, archived }: { partId: string; archived: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const setArchived = async (value: boolean) => {
    setBusy(true);
    await supabase.from("parts").update({ archived: value }).eq("id", partId);
    setBusy(false);
    setConfirming(false);
    router.refresh();
  };

  if (archived) {
    return (
      <button onClick={() => setArchived(false)} disabled={busy} className="yl-btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
        {busy ? "…" : "Restore"}
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="yl-col yl-gap-1" style={{ alignItems: "flex-end" }}>
        <span style={{ fontSize: 10.5, color: "var(--text-faint)", textAlign: "right", maxWidth: 160 }}>
          Hides it from active lists, but keeps it linked to any past invoice. Restorable anytime.
        </span>
        <div className="yl-row yl-gap-2">
          <button onClick={() => setArchived(true)} disabled={busy} className="yl-btn-primary" style={{ padding: "4px 10px", fontSize: 11 }}>
            {busy ? "…" : "Archive"}
          </button>
          <button onClick={() => setConfirming(false)} className="yl-btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="yl-icon-btn" title="Archive this part">
      🗄
    </button>
  );
}
