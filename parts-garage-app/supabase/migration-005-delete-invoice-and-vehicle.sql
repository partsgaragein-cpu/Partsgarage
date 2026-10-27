-- Migration 005 — Guarded delete for invoices and vehicles (cars). Safe to re-run.
-- Both run as one all-or-nothing step, only for logged-in users, and every deleted row is
-- kept in the activity log (old_data), so a deletion can always be traced and reconstructed.

-- Delete an invoice: its lines are removed and the parts on it go back to Available.
create or replace function delete_invoice(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parts text[];
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from invoices where id = p_id) then raise exception 'Invoice not found'; end if;

  select coalesce(array_agg(part_id), '{}') into v_parts from invoice_items where invoice_id = p_id;

  delete from invoice_items where invoice_id = p_id;
  delete from invoices where id = p_id;

  -- parts that were sold on this invoice are available again (unless they are on another invoice)
  update parts set status = 'Available', actual_price = null
  where id = any(v_parts) and status = 'Sold'
    and not exists (select 1 from invoice_items ii where ii.part_id = parts.id);

  -- a car with an unsold part is not "fully sold" any more
  update vehicles set fully_sold_at = null
  where fully_sold_at is not null
    and id in (select vehicle_id from parts where id = any(v_parts) and status <> 'Sold');
end $$;

-- Delete a car: only if none of its parts has ever been on an invoice (delete those invoices first).
-- Its parts, photo records and expenses are removed with it. Photo FILES stay in the Backblaze bucket.
create or replace function delete_vehicle(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from vehicles where id = p_id) then raise exception 'Car not found'; end if;
  if exists (select 1 from invoice_items ii join parts p on p.id = ii.part_id where p.vehicle_id = p_id) then
    raise exception 'Parts from this car are on an invoice. Delete those invoices first, then delete the car.';
  end if;

  delete from media where vehicle_id = p_id or part_id in (select id from parts where vehicle_id = p_id);
  delete from expenses where vehicle_id = p_id;
  delete from parts where vehicle_id = p_id;
  delete from vehicles where id = p_id;
end $$;

revoke all on function delete_invoice(uuid) from public, anon;
revoke all on function delete_vehicle(uuid) from public, anon;
grant execute on function delete_invoice(uuid) to authenticated;
grant execute on function delete_vehicle(uuid) to authenticated;
