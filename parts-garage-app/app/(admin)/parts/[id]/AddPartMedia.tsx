"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadFilesToR2 } from "@/lib/uploadMedia";
import MediaUploader from "@/components/MediaUploader";

export default function AddPartMedia({ partId }: { partId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await uploadFilesToR2(files, `parts/${partId}`);
      await supabase.from("media").insert(
        uploaded.map((u) => ({ part_id: partId, type: u.type, storage_path: u.publicUrl }))
      );
      setFiles([]);
      router.refresh();
    } catch {
      // leave the picked files in place so the user can retry
    }
    setUploading(false);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <MediaUploader files={files} setFiles={setFiles} label="Add more photos / videos" />
      {files.length > 0 && (
        <button onClick={handleUpload} disabled={uploading} className="yl-btn-primary">
          {uploading ? "Uploading…" : `Upload ${files.length} file(s)`}
        </button>
      )}
    </div>
  );
}
