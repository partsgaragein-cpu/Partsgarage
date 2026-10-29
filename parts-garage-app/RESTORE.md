# Restoring Parts Garage from a backup

Tested on 2026-10-29: the database was rebuilt from this repo into an empty Supabase project, a real
nightly backup was loaded, and the result was compared with the live database (structure identical;
rows identical apart from edits made after the backup was taken).

## What the nightly backup contains
`backups/YYYY-MM-DD.json` in the Backblaze bucket (taken ~midnight IST): vehicles, media, parts, expenses,
invoices, invoice_items, activity_log, profiles (the last two from 29 Oct 2026 on).

## What it does NOT contain
- **Changes since the backup ran** (up to ~24 hours of work).
- **Logins** (Supabase Authentication) — recreate them by hand.
- **Photo/video files** — they live only in the Backblaze bucket; the backup holds their paths.
- **Database structure and rules** — these are rebuilt from `supabase/schema.sql` + the migrations.

## Steps
1. **Database.** Use the existing Supabase project, or create a new one. In *SQL Editor*, run in this order:
   `supabase/schema.sql`, then `migration-002-…`, `003-…`, `004-…`, `005-…`.
   (Skip this if only the data was lost and the structure is intact.)
2. **Logins.** *Authentication → Users*: create the two logins again (same emails, new passwords if needed).
3. **Backup file.** Download the newest good `backups/….json` from Backblaze.
4. **Make the restore script** (needs Node 18+):
   `node scripts/make-restore-sql.mjs path/to/backup.json > restore.sql`
5. **Run it.** Paste the contents of `restore.sql` into the *SQL Editor* and run. It loads the tables parents-first,
   leaves rows that already exist untouched (safe to run twice), pauses the Activity recorder while loading, and
   **cancels everything** if any row from the file fails to arrive. The last result table shows the row counts.
6. **Names for the Activity page.** In a new project the logins get new IDs, so link the names again:
   ```sql
   insert into profiles (user_id, display_name)
   select id, case email when 'user123@gmail.com' then 'Sarthak' when 'user1234@gmail.com' then 'Sunny' end
   from auth.users where email in ('user123@gmail.com','user1234@gmail.com')
   on conflict (user_id) do update set display_name = excluded.display_name;
   ```
7. **If you made a new project:** in Vercel → Settings → Environment Variables, update
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, then redeploy.
8. **Check:** sign in, open Parts / Invoices / Activity, and spot-check a few records and photos.

## Notes
- Very large backups (many MB) may be too big to paste into the SQL Editor; ask for help splitting the file by table.
- Photos only reappear if the Backblaze bucket still exists; restoring the database does not copy files.
- Rehearse this once or twice a year, and after any big change to the database.
