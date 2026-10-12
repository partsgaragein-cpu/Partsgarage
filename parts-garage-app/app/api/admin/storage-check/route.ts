import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createUploadUrl, signKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Admin-only health check for photo/video storage.
//
//   /api/admin/storage-check           -> reports what's wrong (changes nothing except one tiny test file)
//   /api/admin/storage-check?apply=1   -> also sets the bucket's CORS rules so browser uploads work
//
// Browser uploads go straight from the user's browser to the Backblaze bucket, and
// Backblaze blocks that unless the bucket's CORS rules explicitly allow uploads (s3_put).
// The simple presets in Backblaze's dashboard don't — hence this route. It runs on the
// server (which can reach Backblaze) using the app's own key, which has permission to
// edit this one bucket. Nothing is ever deleted.

const B2_AUTH = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account";
const PRODUCTION_ORIGIN = "https://partsgarage-8foi.vercel.app";

const json = (b: any) => b.json().catch(() => null);

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in first, then open this page again." }, { status: 401 });

  const apply = request.nextUrl.searchParams.get("apply") === "1";
  const origin = request.nextUrl.origin;
  const verdict: string[] = [];
  const details: Record<string, any> = {};

  const keyId = process.env.B2_KEY_ID || "";
  const appKey = process.env.B2_APPLICATION_KEY || "";
  const bucketName = process.env.B2_BUCKET_NAME || "";
  const endpoint = process.env.B2_ENDPOINT || "";

  // --- 0. Are the settings present and sensible? (never prints the secret itself) ---
  const missing = Object.entries({ B2_ENDPOINT: endpoint, B2_BUCKET_NAME: bucketName, B2_KEY_ID: keyId, B2_APPLICATION_KEY: appKey })
    .filter(([, v]) => !v).map(([k]) => k);
  details.settings = {
    missing,
    keyIdLength: keyId.length,
    applicationKeyLength: appKey.length,
    hasStrayWhitespace: [keyId, appKey, bucketName, endpoint].some((v) => v !== v.trim()),
    endpointHasProtocol: /^https?:\/\//.test(endpoint),
  };
  if (missing.length) {
    verdict.push(`❌ These settings are missing in Vercel (or the site wasn't redeployed after adding them): ${missing.join(", ")}`);
    return respond(verdict, details, origin, apply);
  }
  if (details.settings.hasStrayWhitespace) verdict.push("⚠️ One of the B2 settings has a space or line break at the start/end. Re-paste it with nothing extra.");

  // --- 1. Does Backblaze accept the key? ---
  let apiUrl = "", token = "", accountId = "", bucketId: string | null = null;
  try {
    const res = await fetch(B2_AUTH, { headers: { Authorization: "Basic " + Buffer.from(`${keyId}:${appKey}`).toString("base64") } });
    const body = await json(res);
    if (!res.ok) {
      details.authorize = { ok: false, status: res.status, code: body?.code, message: body?.message };
      verdict.push(`❌ Backblaze rejected the key (${body?.code || res.status}). The B2_KEY_ID or B2_APPLICATION_KEY in Vercel is wrong — usually one character mistyped. Re-copy the application key from Backblaze; if it's no longer shown, create a new key and update both values.`);
      return respond(verdict, details, origin, apply);
    }
    apiUrl = body.apiUrl; token = body.authorizationToken; accountId = body.accountId;
    bucketId = body.allowed?.bucketId ?? null;
    details.authorize = { ok: true, restrictedToBucket: body.allowed?.bucketName ?? null, canEditBucketSettings: !!body.allowed?.capabilities?.includes("writeBuckets") };
    verdict.push("✅ Backblaze accepted the key.");
    if (body.allowed?.bucketName && body.allowed.bucketName !== bucketName) {
      verdict.push(`❌ The key only works for bucket "${body.allowed.bucketName}", but B2_BUCKET_NAME is "${bucketName}".`);
    }
  } catch (e: any) {
    details.authorize = { ok: false, error: String(e?.message || e) };
    verdict.push("❌ Could not contact Backblaze from the server.");
    return respond(verdict, details, origin, apply);
  }

  const b2Post = async (path: string, payload: any) => {
    const res = await fetch(`${apiUrl}/b2api/v2/${path}`, { method: "POST", headers: { Authorization: token, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return { ok: res.ok, status: res.status, body: await json(res) };
  };

  // --- 2. Current CORS rules on the bucket ---
  try {
    const list = await b2Post("b2_list_buckets", bucketId ? { accountId, bucketId } : { accountId, bucketName });
    const bucket = list.body?.buckets?.[0];
    if (!list.ok || !bucket) {
      details.currentCorsRules = { error: list.body?.message || `status ${list.status}` };
      verdict.push("⚠️ Could not read the bucket's current CORS rules.");
    } else {
      bucketId = bucket.bucketId;
      details.bucketType = bucket.bucketType;
      details.currentCorsRules = bucket.corsRules;
      if (bucket.bucketType !== "allPrivate") verdict.push(`⚠️ The bucket is "${bucket.bucketType}" — it should be Private.`);
    }
  } catch (e: any) {
    details.currentCorsRules = { error: String(e?.message || e) };
  }

  // --- 3. Optionally set the rules that browser uploads need ---
  const wantedRules = [{
    corsRuleName: "partsgarage-browser-upload",
    allowedOrigins: Array.from(new Set([origin, PRODUCTION_ORIGIN])),
    allowedOperations: ["s3_put", "s3_get", "s3_head"],
    allowedHeaders: ["*"],
    exposeHeaders: ["etag"],
    maxAgeSeconds: 3600,
  }];
  details.wantedCorsRules = wantedRules;
  if (apply && bucketId) {
    try {
      const upd = await b2Post("b2_update_bucket", { accountId, bucketId, corsRules: wantedRules });
      details.applyResult = upd.ok ? { ok: true, corsRulesNow: upd.body?.corsRules } : { ok: false, status: upd.status, code: upd.body?.code, message: upd.body?.message };
      verdict.push(upd.ok
        ? "✅ Upload permissions (CORS) were set on the bucket. Backblaze can take about a minute to apply them."
        : `❌ Could not set the CORS rules: ${upd.body?.message || upd.status}`);
    } catch (e: any) {
      details.applyResult = { ok: false, error: String(e?.message || e) };
      verdict.push("❌ Could not set the CORS rules.");
    }
  } else if (!apply) {
    const hasPut = Array.isArray(details.currentCorsRules) && details.currentCorsRules.some((r: any) => r.allowedOperations?.includes("s3_put"));
    verdict.push(hasPut
      ? "✅ The bucket already has an upload (s3_put) CORS rule."
      : "❌ The bucket has no upload (s3_put) CORS rule — browser uploads are blocked. Open this same page with ?apply=1 on the end to fix it.");
  }

  // --- 4. Real upload + download test through the app's own signing code ---
  const testKey = "diagnostics/storage-check.txt";
  const stamp = `storage check ${new Date().toISOString()}`;
  let putUrl = "";
  try {
    putUrl = await createUploadUrl(testKey, "text/plain");
    const put = await fetch(putUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: stamp });
    const putText = put.ok ? "" : await put.text().catch(() => "");
    details.serverUploadTest = { ok: put.ok, status: put.status, code: putText.match(/<Code>(.*?)<\/Code>/)?.[1], message: putText.match(/<Message>(.*?)<\/Message>/)?.[1] };
    if (put.ok) {
      const get = await fetch(await signKey(testKey));
      const text = await get.text().catch(() => "");
      details.serverDownloadTest = { ok: get.ok && text === stamp, status: get.status };
      verdict.push(get.ok && text === stamp
        ? "✅ A real test file was uploaded and read back through a signed link — storage itself works."
        : "❌ The test file uploaded but could not be read back through a signed link.");
    } else {
      verdict.push(`❌ Storage rejected a test upload (${details.serverUploadTest.code || put.status}). Check B2_ENDPOINT matches the bucket's endpoint and B2_BUCKET_NAME is exact.`);
    }
  } catch (e: any) {
    details.serverUploadTest = { ok: false, error: String(e?.message || e) };
    verdict.push("❌ The test upload failed before reaching storage.");
  }

  // --- 5. Would a browser's CORS preflight for an upload be allowed? ---
  if (putUrl) {
    try {
      const pre = await fetch(putUrl, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
      const allow = pre.headers.get("access-control-allow-origin");
      const ok = pre.status < 300 && (allow === origin || allow === "*");
      details.browserUploadPreflight = { ok, status: pre.status, allowOrigin: allow, allowMethods: pre.headers.get("access-control-allow-methods") };
      verdict.push(ok
        ? `✅ Backblaze will allow browser uploads from ${origin}.`
        : `❌ Backblaze would still block browser uploads from ${origin}${apply ? " — wait a minute and open this page again, since new rules take a little while to apply" : " — open this page with ?apply=1 on the end to fix it"}.`);
    } catch (e: any) {
      details.browserUploadPreflight = { ok: false, error: String(e?.message || e) };
    }
  }

  return respond(verdict, details, origin, apply);
}

function respond(verdict: string[], details: Record<string, any>, origin: string, apply: boolean) {
  return new NextResponse(JSON.stringify({ verdict, checkedFrom: origin, appliedFix: apply, details }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
