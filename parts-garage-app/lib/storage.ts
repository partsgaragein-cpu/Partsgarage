import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Backblaze B2 speaks the standard S3 API, so we point the AWS SDK at B2's
// endpoint. The bucket is PRIVATE: nothing in it is reachable by a plain URL.
// Browsers only get short-lived signed links, generated here on the server.
//
// Env vars (set in Vercel):
//   B2_ENDPOINT         e.g. s3.eu-central-003.backblazeb2.com
//   B2_BUCKET_NAME      e.g. partsgarage-main
//   B2_KEY_ID           application key ID
//   B2_APPLICATION_KEY  application key secret (server-only, never NEXT_PUBLIC_)

let _client: S3Client | null = null;

// Created lazily so a missing env var can't break the build — it only matters
// when something actually tries to talk to storage.
function client(): S3Client {
  if (!_client) {
    const host = (process.env.B2_ENDPOINT || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
    // "s3.eu-central-003.backblazeb2.com" -> region "eu-central-003"
    const region = host.split(".")[1] || "us-west-004";
    _client = new S3Client({
      region,
      endpoint: `https://${host}`,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID!,
        secretAccessKey: process.env.B2_APPLICATION_KEY!,
      },
      // Newer AWS SDK versions add checksum parameters by default, which B2's
      // S3 API doesn't accept on presigned uploads. Only send them when required.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return _client;
}

const bucket = () => process.env.B2_BUCKET_NAME!;

// 5-minute signed link the browser uses to PUT a file straight into the bucket.
export async function createUploadUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );
}

// Used by the daily backup job (runs on the server, no browser involved).
export async function putObject(key: string, body: string, contentType: string) {
  await client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Turns a stored file key into a temporary viewing link.
//
// The signing time is pinned to the start of the current UTC day, so every
// page load that day produces the *same* URL for the same file. That lets the
// browser cache images instead of re-downloading them on every click (which
// would eat the free download allowance). Links stay valid for 3 days from
// that moment, so at any time of day they have at least 2 days left.
export async function signKey(storagePath: string): Promise<string> {
  // Rows saved before the switch to a private bucket hold a full URL — leave those alone.
  if (/^https?:\/\//.test(storagePath)) return storagePath;
  try {
    return await getSignedUrl(
      client(),
      new GetObjectCommand({ Bucket: bucket(), Key: storagePath }),
      { expiresIn: 3 * 24 * 60 * 60, signingDate: new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS) }
    );
  } catch (err) {
    // A storage misconfiguration should show broken images, not take the whole page down.
    console.error("Could not sign media link:", err);
    return "";
  }
}

// Swaps the stored key for a signed link on every media row. Everything else on the row is kept.
export async function signMedia<T extends { storage_path: string }>(rows: T[] | null | undefined): Promise<T[]> {
  if (!rows) return [];
  return Promise.all(rows.map(async (r) => ({ ...r, storage_path: await signKey(r.storage_path) })));
}
