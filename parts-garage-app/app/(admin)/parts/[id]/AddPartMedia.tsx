"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadAndRecordMedia } from "@/lib/uploadMedia";
import MediaUploader from "@/components/MediaUploader";

export default function AddPartMedia({ partId }: { partId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      await uploadAndRecordMedia(supabase, files, `parts/${partId}`, { part_id: partId });
      setFiles([]);
      router.refresh();
    } catch (e: any) {
      // keep the picked files in place so the user can retry
      setError(e?.message || "Upload failed.");
    }
    setUploading(false);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <MediaUploader files={files} setFiles={setFiles} label="Add more photos / videos" />
      {error && <div style={{ fontSize: 12.5, color: "#E5484D", marginBottom: 12 }}>{error}</div>}
      {files.length > 0 && (
        <button onClick={handleUpload} disabled={uploading} className="yl-btn-primary">
          {uploading ? "Uploading…" : `Upload ${files.length} file(s)`}
        </button>
      )}
    </div>
  );
}
