export type UploadedFile = {
  storagePath: string; // the file's key in the bucket — this is what we save in the media table
  type: "image" | "video";
  label: string;
};

// Uploads one file directly to the private bucket via a presigned URL, and
// returns the key to store in Supabase's `media` table.
export async function uploadFileToStorage(file: File, folder: string): Promise<UploadedFile> {
  // 1. Ask our own API for a signed upload URL (small, fast request)
  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, folder }),
  });

  if (!res.ok) throw new Error("Could not get an upload URL");
  const { uploadUrl, key } = await res.json();

  // 2. Upload the actual file bytes straight to storage — never touches our server
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) throw new Error("Upload to storage failed");

  return {
    storagePath: key,
    type: file.type.startsWith("video") ? "video" : "image",
    label: file.name,
  };
}

export async function uploadFilesToStorage(files: File[], folder: string): Promise<UploadedFile[]> {
  return Promise.all(files.map((f) => uploadFileToStorage(f, folder)));
}
