-- Migration 003 — Activity log: who added / changed / deleted what, and when.
-- Run once in Supabase → SQL Editor (safe to re-run).

-- 1) Who is who: maps each login to a display name (Sarthak / Sunny)
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) > 0)
);
alter table profiles enable row level security;
drop policy if exists "Authenticated can read profiles" on profiles;
create policy "Authenticated can read profiles" on profiles for select to authenticated using (true);
-- no insert/update/delete policies: names are set by the admin in SQL, not from the app

-- 2) The log itself. The app can only READ it; nobody can edit or delete entries from the app.
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  user_name text not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  table_name text not null,
  record_id text,
  record_label text,
  old_data jsonb,
  new_data jsonb
);
create index if not exists activity_log_created_idx on activity_log (created_at desc);
create index if not exists activity_log_user_idx on activity_log (user_id);
alter table activity_log enable row level security;
drop policy if exists "Authenticated can read activity_log" on activity_log;
create policy "Authenticated can read activity_log" on activity_log for select to authenticated using (true);

-- 3) The recorder (runs inside the database, so it cannot be skipped from the app)
create or replace function log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  uname text;
  oldr jsonb; newr jsonb; rec jsonb;
begin
  if uid is not null then
    select display_name into uname from profiles where user_id = uid;
    if uname is null then select email into uname from auth.users where id = uid; end if;
  end if;
  uname := coalesce(uname, 'System / SQL');

  if TG_OP = 'DELETE' then oldr := to_jsonb(OLD); rec := oldr;
  elsif TG_OP = 'INSERT' then newr := to_jsonb(NEW); rec := newr;
  else
    oldr := to_jsonb(OLD); newr := to_jsonb(NEW); rec := newr;
    if oldr = newr then return NEW; end if;  -- nothing actually changed
  end if;

  insert into activity_log (user_id, user_name, action, table_name, record_id, record_label, old_data, new_data)
  values (
    uid, uname, TG_OP, TG_TABLE_NAME, rec->>'id',
    coalesce(rec->>'invoice_no', rec->>'registration_number', rec->>'name', rec->>'description', rec->>'category', rec->>'storage_path'),
    oldr, newr
  );

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

-- 4) Attach the recorder to every data table
do $$
declare t text;
begin
  foreach t in array array['vehicles','parts','invoices','invoice_items','expenses','media']
  loop
    execute format('drop trigger if exists trg_activity_log on public.%I', t);
    execute format('create trigger trg_activity_log after insert or update or delete on public.%I for each row execute function public.log_activity()', t);
  end loop;
end $$;
