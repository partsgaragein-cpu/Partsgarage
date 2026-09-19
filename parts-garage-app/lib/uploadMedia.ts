export type UploadedFile = {
  publicUrl: string;
  type: "image" | "video";
  label: string;
};

// Uploads one file directly to R2 via a presigned URL, and returns
// the public URL to store in Supabase's `media` table.
export async function uploadFileToR2(file: File, folder: string): Promise<UploadedFile> {
  // 1. Ask our own API for a signed upload URL (small, fast request)
  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, folder }),
  });

  if (!res.ok) throw new Error("Could not get an upload URL");
  const { uploadUrl, publicUrl } = await res.json();

  // 2. Upload the actual file bytes straight to R2 — never touches our server
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) throw new Error("Upload to storage failed");

  return {
    publicUrl,
    type: file.type.startsWith("video") ? "video" : "image",
    label: file.name,
  };
}

export async function uploadFilesToR2(files: File[], folder: string): Promise<UploadedFile[]> {
  return Promise.all(files.map((f) => uploadFileToR2(f, folder)));
}
