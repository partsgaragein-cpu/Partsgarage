import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadedFile = {
  storagePath: string; // the file's key in the bucket — this is what we save in the media table
  type: "image" | "video";
  label: string;
};

// Uploads one file directly to the private bucket via a presigned URL, and
// returns the key to store in Supabase's `media` table.
//
// Every failure throws an Error whose message says what actually went wrong,
// so the screens can show it instead of silently saving a record with no photo.
export async function uploadFileToStorage(file: File, folder: string): Promise<UploadedFile> {
  // 1. Ask our own API for a signed upload URL (small, fast request)
  let res: Response;
  try {
    res = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, folder }),
    });
  } catch {
    throw new Error("Could not reach the server to start the upload. Check your internet connection and try again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `The server refused to start the upload (error ${res.status}). Try logging out and back in.`);
  }
  const { uploadUrl, key } = await res.json();

  // 2. Upload the actual file bytes straight to storage — never touches our server
  let uploadRes: Response;
  try {
    uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch {
    // The browser gives no detail when a cross-origin request is blocked, but
    // that is by far the most common cause of this exact failure.
    throw new Error(
      "Your browser was blocked from sending the file to storage. This is almost always the bucket's CORS setting — while logged in, open /api/admin/storage-check?apply=1 and it will fix it."
    );
  }
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    const code = text.match(/<Code>(.*?)<\/Code>/)?.[1];
    throw new Error(`Storage rejected the upload (${uploadRes.status}${code ? ` ${code}` : ""}). Open /api/admin/storage-check while logged in for details.`);
  }

  return {
    storagePath: key,
    type: file.type.startsWith("video") ? "video" : "image",
    label: file.name,
  };
}

export async function uploadFilesToStorage(files: File[], folder: string): Promise<UploadedFile[]> {
  return Promise.all(files.map((f) => uploadFileToStorage(f, folder)));
}

// Uploads the files, then records each one in the media table against its
// vehicle or part. Throws a readable Error if either step fails.
export async function uploadAndRecordMedia(
  supabase: SupabaseClient,
  files: File[],
  folder: string,
  parent: { vehicle_id: string } | { part_id: string }
) {
  const uploaded = await uploadFilesToStorage(files, folder);
  const { error } = await supabase.from("media").insert(
    uploaded.map((u) => ({ ...parent, type: u.type, storage_path: u.storagePath }))
  );
  if (error) throw new Error(`The file uploaded but could not be saved to the database: ${error.message}`);
}
