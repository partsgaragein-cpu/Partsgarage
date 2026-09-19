# Parts Garage — Setup & Deployment

**Deletion policy:** nothing in this system deletes anything automatically — not Supabase rows, not R2 files (media or backups), not on any schedule or cascade. Every foreign key uses `on delete restrict`, not `cascade`, so the database itself refuses to remove a vehicle/invoice while parts, media, expenses, or invoice items still point to it. There is also no delete button or delete API route anywhere in the app. If something ever needs to be removed, it has to be done by hand in the Supabase or Cloudflare dashboard.

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

## 3. Set up Cloudflare R2

1. Create a bucket in R2 (e.g. `parts-garage-media`)
2. **Settings → Public Access** → enable public read, note the public URL (`pub-xxxx.r2.dev` or your custom domain)
3. **R2 → Manage API Tokens** → create a token with Object Read & Write on that bucket → save the Access Key ID and Secret Access Key
4. Note your **Account ID** from the R2 overview page

## 4. Environment variables

Copy `.env.example` to `.env.local` and fill in everything from steps 2 and 3, plus your real company GSTIN/address for invoices:

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

Supabase's free tier keeps zero automatic backups — if a row gets deleted by accident, it's gone for good. This job works around that: once a day it reads every table out of Supabase and writes the whole thing as one JSON file into R2, right alongside the photos and videos. **Nothing is ever deleted, either from Supabase or from R2** — every day's backup is a new file, kept forever.

1. **Get the service role key** — Supabase dashboard → **Project Settings → API** → copy the **`service_role`** secret key (not the `anon` key you used before). This key bypasses Row Level Security, which is exactly why it's needed here: the backup job runs with no logged-in user, so the `anon` key would return nothing.
2. **Make up a `CRON_SECRET`** — any long random string, e.g. run `openssl rand -hex 32` in a terminal, or just mash the keyboard. This is what proves a request to the backup URL actually came from Vercel and not a random visitor who found the link.
3. Add both `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` to `.env.local` (for local testing) **and** to Vercel's Environment Variables (for production — this is the one that actually matters, since the cron only ever runs on Vercel's servers).
4. That's it — `vercel.json` tells Vercel to hit `/api/cron/backup` once a day at midnight IST. No manual scheduling needed.

**Where the backups land:** in your R2 bucket, under `backups/2026-09-04.json` (one file per day). Open the bucket in Cloudflare's dashboard any time to see them.

**To test it manually** rather than waiting for the schedule: visit `https://your-app.vercel.app/api/cron/backup` with an `Authorization: Bearer <your-CRON_SECRET>` header — easiest way is a quick `curl`:
```
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/backup
```
A successful run returns JSON with the row counts backed up for each table.

**If you ever need to restore from one:** the JSON file has one key per table (`vehicles`, `parts`, `expenses`, etc.), each holding the full array of rows exactly as Supabase returned them. Restoring means writing a small script that reads the file and re-inserts each array back into its table — not a one-click restore, but everything needed to rebuild is sitting safely in R2.

**Note on the free plan combo:** Vercel's Hobby (free) plan supports cron jobs but limits each to running once a day, which is exactly what this needs — no upgrade required there either.

## How the pieces connect

- **Text data** (vehicles, parts, expenses, invoices) → Supabase, via `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server components)
- **Photos/videos** → uploaded directly from the browser to R2 using a presigned URL (`lib/uploadMedia.ts` + `app/api/upload-url/route.ts`), so large video files never pass through Vercel's server — only the resulting public URL gets saved into Supabase's `media` table
- **Admin access control** → `middleware.ts` checks for a valid Supabase session on every request; no session means an automatic redirect to `/login`, enforced at the server level, not just hidden in the UI
- **Public gallery** (`/car/[reg]`) → intentionally outside auth checks, since mechanics need to view it without logging in
- **Invoice PDFs** → `window.print()` on a dedicated print-styled page (`/invoices/[id]`) — this works properly here since it's a real deployed page, unlike a sandboxed preview
- **Daily backup** → Vercel Cron triggers `/api/cron/backup` once a day, which dumps every Supabase table to a dated JSON file in R2 (`lib/r2.ts` + `app/api/cron/backup/route.ts`, scheduled via `vercel.json`)

## What's simplified vs. the full design

This covers the complete core loop (auth, vehicles, media, parts with standalone support, expenses, multi-item GST invoicing with the mark-as-sold toggle, payments, profit tracking, reports). Not yet wired in, worth adding next:
- `fully_sold_at` is stamped automatically once every part on a vehicle is Sold/Scrap, but nothing acts on it — no media, records, or files are ever deleted automatically. It's purely a status marker for now, useful if you want to build a report or filter by it later.
- Archive/restore UI for parts (the `archived` column and RLS support it; needs the buttons added)
- Editing existing vehicles/parts/expenses (currently create + view; edit forms follow the same pattern as the "new" forms)
