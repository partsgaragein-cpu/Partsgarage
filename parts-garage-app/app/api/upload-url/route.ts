import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { createClient } from "@/lib/supabase/server";

// Called by the browser before uploading a file. Returns a short-lived
// signed URL that lets the browser PUT the file straight to R2 —
// the actual photo/video bytes never touch our own server.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { filename, contentType, folder } = await request.json();

  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType are required" }, { status: 400 });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const key = `${folder || "misc"}/${Date.now()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 }); // 5 minutes to complete the upload
  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  return NextResponse.json({ uploadUrl, publicUrl, key });
}
