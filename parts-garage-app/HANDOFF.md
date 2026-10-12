# Handoff — Parts Garage (Yardline) CRM

A copy of the GitHub repo `partsgaragein-cpu/Partsgarage` (the app lives in the `parts-garage-app/` folder, so Vercel's Root Directory is `parts-garage-app`). Next.js 14 + Supabase + Backblaze B2, deployed on Vercel at https://partsgarage-8foi.vercel.app (Vercel project `partsgarage-8foi`, region sin1).

## Where things live
- **Database:** Supabase project `partsgarage-singapore` (ref `nrvxveqmgvobmokzynxw`, ap-southeast-1). Schema is in `supabase/schema.sql`. Contains only test data (a few vehicles, one part, no photos).
- **Photos/videos/backups:** one **private** Backblaze B2 bucket `partsgarage-main` (EU Central, endpoint `s3.eu-central-003.backblazeb2.com`). The DB stores each file's bucket *key* in `media.storage_path`; pages turn it into a signed link on the server (`lib/storage.ts`). Cloudflare R2 was dropped (payment method kept failing).
- **Vercel env vars (names only):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (must be the legacy JWT anon key, not the `sb_publishable_` one), `SUPABASE_SERVICE_ROLE_KEY`, `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `CRON_SECRET`. Variables only apply to a *new* deployment.
- **Admin login:** one user created by hand in Supabase Auth (no public sign-up page, by design).

## Photo upload — the thing that was broken
Browser uploads go straight to Backblaze with a presigned URL. Backblaze blocks that unless the bucket's CORS rules allow `s3_put`, and its dashboard presets don't. Fix: log in and open `/api/admin/storage-check?apply=1` on the live site. It sets the rule using the app's own key and runs a real upload/download test; the first lines of the result say what's right or wrong. Open `/api/admin/storage-check` (no `?apply=1`) to just re-check. Upload failures now show their real reason on screen instead of failing silently.

## Rules the owner set
- **Nothing is ever deleted** — no delete buttons, FKs are `on delete restrict`, parts are archived not deleted, backups are never removed.
- Sold parts stay in the single `parts` table (hidden by default via the "Show Sold" toggle); `parts_public` view feeds the public inventory and hides `min_price`/`actual_price`.

## Done in this session
Public `/inventory` page (cars + standalone parts), photos on parts, part edit/archive/restore with search, vehicle edit form + add-photos on the vehicle page, whole-row click on vehicle/dashboard/parts-of-vehicle tables, Reports (flagged items, best category, tap-to-check stock list), Singapore DB migration, Backblaze private-bucket storage.

## Still open
- Confirm photo upload works end to end after running the storage check.
- Smaller gaps vs the original spec: search on the Vehicles list; "Media Files" dashboard card and green/red Net Position; "Share Gallery Link" modal (copy button + mechanic preview); slide-over panels instead of full-page forms; Record-payment link on the Invoices list.
- The login page shows raw error text (left in for debugging) — swap back to a friendly message.
- Set real company details (`NEXT_PUBLIC_COMPANY_*`) for invoices.
- Revoke the GitHub token that was shared in chat. The Backblaze key also allows deleting files (Backblaze offers no read/write-without-delete option); the app never deletes.
- The Vercel connector sometimes returns "No approval received" for env/deployment calls; setting env vars by hand in the Vercel dashboard always works.
