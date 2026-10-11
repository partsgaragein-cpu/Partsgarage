import { NextRequest, NextResponse } from "next/server";
import { createUploadUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

// Called by the browser before uploading a file. Returns a short-lived signed
// URL that lets the browser PUT the file straight into the private bucket —
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

  // Photos and videos only, and only into the vehicle/part folders — so an upload
  // can never land in (or overwrite anything under) the backups folder.
  if (!/^(image|video)\//.test(contentType)) {
    return NextResponse.json({ error: "Only images and videos can be uploaded" }, { status: 400 });
  }
  const safeFolder = typeof folder === "string" ? folder.replace(/[^a-zA-Z0-9/_-]/g, "_") : "";
  if (!/^(vehicles|parts)\//.test(safeFolder)) {
    return NextResponse.json({ error: "Invalid upload folder" }, { status: 400 });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const key = `${safeFolder}/${Date.now()}-${safeName}`;

  const uploadUrl = await createUploadUrl(key, contentType);

  // `key` is what gets saved in the database — not a URL. Viewing links are
  // generated fresh on the server whenever a page that shows the file loads.
  return NextResponse.json({ uploadUrl, key });
}
