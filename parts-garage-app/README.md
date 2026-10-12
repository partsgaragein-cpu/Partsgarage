# Parts Garage — Setup & Deployment

**Deletion policy:** nothing in this system deletes anything automatically — not Supabase rows, not storage files (media or backups), not on any schedule or cascade. Every foreign key uses `on delete restrict`, not `cascade`, so the database itself refuses to remove a vehicle/invoice while parts, media, expenses, or invoice items still point to it. There is also no delete button or delete API route anywhere in the app. If something ever needs to be removed, it has to be done by hand in the Supabase or Backblaze dashboard.

## 1. Install dependencies

```
npm install
```

## 2. Set up Supabase

1. Create a project at supabase.com
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it — this creates every table, the profit view, the `fully_sold_at` status trigger, the `parts_public` and `sold_parts_ledger` views, and all RLS policies in one go
3. **Authentication → Providers** → make sure Email is enabled
4. **Authentication → Users → Add User** → create the one admin login manually (email + password). There's no public sign-up page in the app on purpose.
5. **Project Settings → API** → copy the **Project URL** and **anon public key**

## 2a. Media on parts + shared inventory link

- Photos/videos can now be attached to a **part**, not just a vehicle — including standalone parts that aren't tied to any car. This uses the same `media` table as before; a row points at either `vehicle_id` or `part_id`, never both.
- `/parts/[id]` is a new admin page showing one part's full detail plus its own gallery, with an "add more photos/videos" uploader for later.
- `/parts` (admin list) defaults to hiding `Sold` parts — click **Show Sold** to see them. The underlying data for record-keeping and profit math never moves; `Sold` is just filtered out of the default view.
- `/inventory` is a new **public** page — the one link to send a customer instead of a link per car. It has two tabs: **Cars** (each linking to its existing `/car/[reg]` gallery, now showing that car's parts too) and **Standalone Parts** (parts with no vehicle, each with its own gallery). Both tabs only ever show unsold stock (`Available`/`Reserved`), pulled from the `parts_public` database view, which also strips `min_price` and `actual_price` so nothing internal leaks through the shared link.
- The **Share Full Inventory** button (Vehicles page) sends the `/inventory` link over WhatsApp. The existing per-car **Share Gallery Link** button still works for sending just one car.

## 3. Set up Backblaze B2 (photo/video + backup storage)

Photos, videos and the daily database backups live in one **private** Backblaze B2 bucket. The first 10 GB is free and no credit card is needed for a private bucket.

1. Create a bucket (e.g. `partsgarage-main`) and set **Files in Bucket are: Private**
2. **Browser uploads need a CORS rule that allows uploads.** Backblaze's one-click CORS presets only allow *viewing* files, so uploads fail with a generic "Failed to fetch". Don't use the presets. Instead, after the app is deployed with the B2 settings below, log in and open `/api/admin/storage-check?apply=1` on your site. It sets the correct rule on the bucket (using the app's own key) and runs a real upload test. Open `/api/admin/storage-check` any time to re-check; the first lines of the result say what is right or wrong in plain English. If you ever add a custom domain, open that page from the new domain with `?apply=1` so it is allowed too.
3. **Application Keys → Add a New Application Key** → restrict it to that one bucket, Read and Write → copy the **keyID** and **applicationKey** immediately (the key is shown once)
4. Note the bucket's **Endpoint** (e.g. `s3.eu-central-003.backblazeb2.com`)

Because the bucket is private, the app stores each file's *key* in the database and the server generates a temporary signed viewing link whenever a page loads (`lib/storage.ts`). Links are pinned to the start of the UTC day so the browser can cache images. Nothing in the bucket, including the backups, is reachable without a signed link.

## 4. Environment variables

Copy `.env.example` to `.env.local` and fill in everything from steps 2 and 3 (`B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_KEY_ID`, `B2_APPLICATION_KEY`), plus your real company GSTIN/address for invoices:

```
cp .env.example .env.local
```

## 5. Run locally

```
npm run dev
```

Visit `localhost:3000` — you'll be redirected to `/login`. Log in with the account you created in Supabase.

## 6. Deploy to Vercel

1. Push this project to a GitHub repository
2. Go to vercel.com → **Add New → Project** → import the repo
3. Vercel auto-detects Next.js — before deploying, open **Environment Variables** and paste in everything from your `.env.local`, including `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` from step 7 below
4. Click **Deploy**
5. Every future push to the repo redeploys automatically
6. Once deployed, Vercel reads `vercel.json` automatically and starts running the daily backup on its own — nothing else to click

## 7. Daily database backup (free, no Supabase Pro needed)

Supabase's free tier keeps zero automatic backups — if a row gets deleted by accident, it's gone for good. This job works around that: once a day it reads every table out of Supabase and writes the whole thing as one JSON file into the private B2 bucket, right alongside the photos and videos. **Nothing is ever deleted, either from Supabase or from the bucket** — every day's backup is a new file, kept forever.

1. **Get the service role key** — Supabase dashboard → **Project Settings → API** → copy the **`service_role`** secret key (not the `anon` key you used before). This key bypasses Row Level Security, which is exactly why it's needed here: the backup job runs with no logged-in user, so the `anon` key would return nothing.
2. **Make up a `CRON_SECRET`** — any long random string, e.g. run `openssl rand -hex 32` in a terminal, or just mash the keyboard. This is what proves a request to the backup URL actually came from Vercel and not a random visitor who found the link.
3. Add both `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` to `.env.local` (for local testing) **and** to Vercel's Environment Variables (for production — this is the one that actually matters, since the cron only ever runs on Vercel's servers).
4. That's it — `vercel.json` tells Vercel to hit `/api/cron/backup` once a day at midnight IST. No manual scheduling needed.

**Where the backups land:** in your B2 bucket, under `backups/2026-09-04.json` (one file per day). Open the bucket under **Browse Files** in Backblaze any time to see them. The bucket is private, so they can't be downloaded by anyone without your Backblaze login or a signed link.

**To test it manually** rather than waiting for the schedule: visit `https://your-app.vercel.app/api/cron/backup` with an `Authorization: Bearer <your-CRON_SECRET>` header — easiest way is a quick `curl`:
```
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/backup
```
A successful run returns JSON with the row counts backed up for each table.

**If you ever need to restore from one:** the JSON file has one key per table (`vehicles`, `parts`, `expenses`, etc.), each holding the full array of rows exactly as Supabase returned them. Restoring means writing a small script that reads the file and re-inserts each array back into its table — not a one-click restore, but everything needed to rebuild is sitting safely in the bucket.

**Note on the free plan combo:** Vercel's Hobby (free) plan supports cron jobs but limits each to running once a day, which is exactly what this needs — no upgrade required there either.

## How the pieces connect

- **Text data** (vehicles, parts, expenses, invoices) → Supabase, via `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server components)
- **Photos/videos** → uploaded directly from the browser to the private B2 bucket using a presigned URL (`lib/uploadMedia.ts` + `app/api/upload-url/route.ts`), so large video files never pass through Vercel's server — only the file's bucket key gets saved into Supabase's `media` table, and pages turn it into a temporary signed link when they load (`lib/storage.ts`)
- **Admin access control** → `middleware.ts` checks for a valid Supabase session on every request; no session means an automatic redirect to `/login`, enforced at the server level, not just hidden in the UI
- **Public gallery** (`/car/[reg]`) → intentionally outside auth checks, since mechanics need to view it without logging in
- **Invoice PDFs** → `window.print()` on a dedicated print-styled page (`/invoices/[id]`) — this works properly here since it's a real deployed page, unlike a sandboxed preview
- **Daily backup** → Vercel Cron triggers `/api/cron/backup` once a day, which dumps every Supabase table to a dated JSON file in the bucket (`lib/storage.ts` + `app/api/cron/backup/route.ts`, scheduled via `vercel.json`)

## What's simplified vs. the full design

This covers the complete core loop (auth, vehicles, media, parts with standalone support, expenses, multi-item GST invoicing with the mark-as-sold toggle, payments, profit tracking, reports). Not yet wired in, worth adding next:
- `fully_sold_at` is stamped automatically once every part on a vehicle is Sold/Scrap, but nothing acts on it — no media, records, or files are ever deleted automatically. It's purely a status marker for now, useful if you want to build a report or filter by it later.
- Archive/restore UI for parts (the `archived` column and RLS support it; needs the buttons added)
- Editing existing vehicles/parts/expenses (currently create + view; edit forms follow the same pattern as the "new" forms)
