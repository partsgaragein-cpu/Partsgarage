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
- **Deleting is limited on purpose.** Parts can be deleted by hand from the part's page (the client asked for this); the `delete_part` database function refuses if the part is on an invoice (archive those instead). Photo *files* stay in the bucket until removed manually in Backblaze. Vehicles, invoices and expenses can't be deleted at all (FKs are `on delete restrict`, no delete policy), and backups are never removed.
- Sold parts stay in the single `parts` table (hidden by default via the "Show Sold" toggle); `parts_public` view feeds the public inventory and hides `min_price`/`actual_price`.

## Done in this session
Public `/inventory` page (cars + standalone parts), photos on parts, part edit/archive/restore with search, vehicle edit form + add-photos on the vehicle page, whole-row click on vehicle/dashboard/parts-of-vehicle tables, Reports (flagged items, best category, tap-to-check stock list), Singapore DB migration, Backblaze private-bucket storage.

## Invoices: editing and payment details
Invoices are editable at `/invoices/<id>/edit` (shared form: `components/InvoiceForm.tsx`) — buyer details, dates, terms, payment, and adding/removing/re-pricing parts. Parts removed from an invoice go back to Available. Each invoice stores one payment method (Cash/Online) and one received-by (Sarthak/Sunny); both are required whenever an amount received is entered. The whole invoice row on the list opens it. Needs `supabase/migration-002-invoice-edit-and-custom-expenses.sql` (applied to the live DB 2026-10-27; also lets expenses use custom category names via "+ Add my own…").

## Activity log (who changed what)
Every add/edit/delete on vehicles, parts, invoices, invoice lines, expenses and media is recorded by database triggers (`supabase/migration-003-activity-log.sql`, applied 2026-10-27) into `activity_log` (read-only from the app). The Activity page (`/activity`) shows it with filters by person and record type. `profiles` maps each login to a display name (user123@gmail.com = Sarthak, user1234@gmail.com = Sunny — assigned arbitrarily; swap in SQL if wrong). Each brother must use his own login. Changes made via SQL show as "System / SQL"; history starts from the day it was switched on.

## Atomic invoice saves and numbering
Creating/editing an invoice calls the database functions `create_invoice` / `update_invoice` (`supabase/migration-004-atomic-invoices.sql`, applied 2026-10-27). Each runs as one transaction: if any step fails nothing is saved. Invoice numbers (PG-00001…) are generated inside the database under a lock, so simultaneous saves can't collide and failed saves leave no gaps. Don't reintroduce client-side counting or multi-step inserts.

## Deleting invoices and cars
Invoice and car pages have a guarded "Delete…" button (confirmation step) calling `delete_invoice` / `delete_vehicle` (`supabase/migration-005-delete-invoice-and-vehicle.sql`, applied 2026-10-27). Deleting an invoice removes its lines and returns its parts to Available. A car can only be deleted once none of its parts is on an invoice; its parts, photo records and expenses go with it (photo files stay in Backblaze). Every deletion is kept in the Activity log with the old data. If the latest invoice is deleted, its number is reused by the next one.

## Part IDs
Format `PG-<last 4 of reg | LOOSE>-<first 3 letters of category>-<number>`. The number is the highest one already used for that prefix plus 1 (`lib/partId.ts`), with a retry if two saves collide and a visible error if saving fails. It used to count rows, which collided with existing IDs as soon as a part was deleted (and the failed save was ignored, so photos could land on the wrong part). Invoice numbers still use a row count, which is safe because invoices can't be deleted.

## Customer link
`/inventory` is the page sent to customers. It has a search box: every word typed must match somewhere in a car's name/registration/make/model/year/fuel/transmission, or in a part's name/part number/category/condition/compatible models (plus its car's details). Matching ignores capitals, spaces and dashes. Search runs in code (`lib/search.ts`), never inside a database query.

## Still open
- Confirm photo upload works end to end after running the storage check.
- Smaller gaps vs the original spec: search on the Vehicles list; "Media Files" dashboard card and green/red Net Position; "Share Gallery Link" modal (copy button + mechanic preview); slide-over panels instead of full-page forms; Record-payment link on the Invoices list.
- The login page shows raw error text (left in for debugging) — swap back to a friendly message.
- Set real company details (`NEXT_PUBLIC_COMPANY_*`) for invoices.
- Revoke the GitHub token that was shared in chat. The Backblaze key also allows deleting files (Backblaze offers no read/write-without-delete option); the app never deletes.
- The Vercel connector sometimes returns "No approval received" for env/deployment calls; setting env vars by hand in the Vercel dashboard always works.

## Backup route
`/api/cron/backup` (daily 18:30 UTC = midnight IST) reads every table in pages of 1,000 (Supabase silently caps requests at 1,000 rows), checks each table's saved row count against its real count, and fails loudly on any mismatch instead of uploading a partial backup. Covers vehicles, media, parts, expenses, invoices, invoice_items, activity_log and profiles. Photo/video FILES are not copied — they exist only in the Backblaze bucket. Add new tables to the TABLES list.

## Restore
See `RESTORE.md` (tested 2026-10-29). `scripts/make-restore-sql.mjs` turns a nightly backup file into one paste-able SQL restore script.
