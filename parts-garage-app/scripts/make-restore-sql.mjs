#!/usr/bin/env node
// Turns a nightly backup file (backups/YYYY-MM-DD.json) into ONE SQL script you paste into
// Supabase → SQL Editor to restore it.
//
//   node scripts/make-restore-sql.mjs path/to/2026-10-27.json > restore.sql
//
// Before running the SQL: the database structure must exist (supabase/schema.sql, then the
// migration-00x files in order) and the two logins must exist (Supabase → Authentication → Users).
// The script is safe to run twice (existing rows are left alone), pauses the Activity recorder
// while loading, and aborts everything if any table's rows don't all arrive.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/make-restore-sql.mjs <backup.json> > restore.sql"); process.exit(1); }
const backup = JSON.parse(readFileSync(file, "utf8"));
const json = JSON.stringify(backup);
if (json.includes("$backupjson$")) { console.error("Backup contains the reserved marker $backupjson$"); process.exit(1); }

// Order matters: parents before children.
const TABLES = ["vehicles", "parts", "media", "expenses", "invoices", "invoice_items"];

const sql = `-- Restore of backup taken at ${backup.taken_at ?? "unknown time"}
do $restore$
declare
  j jsonb := $backupjson$${json}$backupjson$::jsonb;
  t text; n_file int; n_db int;
begin
  -- 1) pause the Activity recorder so the restore doesn't add false "who did what" entries
  foreach t in array array['vehicles','parts','invoices','invoice_items','expenses','media'] loop
    execute format('alter table public.%I disable trigger trg_activity_log', t);
  end loop;

  -- 2) load every table, parents first; rows that already exist are left untouched
${TABLES.map((t) => `  if j ? '${t}' then insert into public.${t} select * from jsonb_populate_recordset(null::public.${t}, j->'${t}') on conflict (id) do nothing; end if;`).join("\n")}
  if j ? 'activity_log' then
    insert into public.activity_log overriding system value select * from jsonb_populate_recordset(null::public.activity_log, j->'activity_log') on conflict (id) do nothing;
    perform setval(pg_get_serial_sequence('public.activity_log','id'), greatest((select coalesce(max(id),1) from public.activity_log), 1));
  end if;
  -- names for the logins: only for logins that exist in this project
  if j ? 'profiles' then
    insert into public.profiles select * from jsonb_populate_recordset(null::public.profiles, j->'profiles') r
    where exists (select 1 from auth.users u where u.id = r.user_id) on conflict (user_id) do nothing;
  end if;

  -- 3) check: every row in the file must now be in the database, or everything is undone
  foreach t in array array['vehicles','parts','media','expenses','invoices','invoice_items','activity_log'] loop
    if j ? t then
      n_file := jsonb_array_length(j->t);
      execute format('select count(*) from public.%I x where x.id::text in (select e->>''id'' from jsonb_array_elements($1) e)', t) into n_db using j->t;
      if n_db <> n_file then raise exception 'RESTORE CHECK FAILED for %: file has % rows, database has %', t, n_file, n_db; end if;
    end if;
  end loop;

  -- 4) switch the Activity recorder back on
  foreach t in array array['vehicles','parts','invoices','invoice_items','expenses','media'] loop
    execute format('alter table public.%I enable trigger trg_activity_log', t);
  end loop;
end
$restore$;

-- Result: rows now in the database
select 'vehicles' as "table", count(*) as rows from public.vehicles
union all select 'parts', count(*) from public.parts
union all select 'media', count(*) from public.media
union all select 'expenses', count(*) from public.expenses
union all select 'invoices', count(*) from public.invoices
union all select 'invoice_items', count(*) from public.invoice_items
union all select 'activity_log', count(*) from public.activity_log
union all select 'profiles', count(*) from public.profiles;
`;
process.stdout.write(sql);
