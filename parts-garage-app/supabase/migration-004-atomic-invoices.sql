-- Migration 004 — Invoices are saved all-or-nothing, and invoice numbers can never collide.
-- Safe to re-run.
-- Each function runs as ONE database transaction: if any step fails, nothing is saved.
-- Invoice numbers are generated inside the database under a lock, so two people saving at
-- the same moment get different, consecutive numbers (no gaps from failed saves).

create or replace function create_invoice(p_invoice jsonb, p_items jsonb, p_mark_sold boolean default true)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id uuid; v_no text; it jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'An invoice needs at least one part';
  end if;
  if coalesce(btrim(p_invoice->>'buyer_name'), '') = '' then
    raise exception 'Buyer name is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('invoice_no'));
  select 'PG-' || lpad((coalesce(max(nullif(regexp_replace(invoice_no, '\D', '', 'g'), '')::int), 0) + 1)::text, 5, '0')
    into v_no from invoices;

  insert into invoices (invoice_no, invoice_date, buyer_name, buyer_phone, buyer_gstin, buyer_vehicle,
                        payment_terms, due_date, amount_received, payment_method, paid_to)
  values (v_no, coalesce(nullif(p_invoice->>'invoice_date', '')::date, current_date),
          p_invoice->>'buyer_name', p_invoice->>'buyer_phone', p_invoice->>'buyer_gstin', p_invoice->>'buyer_vehicle',
          p_invoice->>'payment_terms', nullif(p_invoice->>'due_date', '')::date,
          coalesce(nullif(p_invoice->>'amount_received', '')::numeric, 0),
          nullif(p_invoice->>'payment_method', ''), nullif(p_invoice->>'paid_to', ''))
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into invoice_items (invoice_id, part_id, description, category, hsn_sac, qty, taxable_value, gst_percent)
    values (v_id, it->>'part_id', it->>'description', it->>'category', it->>'hsn_sac',
            (it->>'qty')::int, (it->>'taxable_value')::numeric, (it->>'gst_percent')::numeric);
    if p_mark_sold then
      update parts set status = 'Sold', actual_price = (it->>'taxable_value')::numeric * (it->>'qty')::int
      where id = it->>'part_id';
    end if;
  end loop;

  return jsonb_build_object('id', v_id, 'invoice_no', v_no);
end $$;

create or replace function update_invoice(p_id uuid, p_invoice jsonb, p_items jsonb, p_mark_sold boolean default true)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  it jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'An invoice needs at least one part';
  end if;
  if coalesce(btrim(p_invoice->>'buyer_name'), '') = '' then
    raise exception 'Buyer name is required';
  end if;

  update invoices set
    invoice_date = coalesce(nullif(p_invoice->>'invoice_date', '')::date, invoice_date),
    buyer_name = p_invoice->>'buyer_name', buyer_phone = p_invoice->>'buyer_phone',
    buyer_gstin = p_invoice->>'buyer_gstin', buyer_vehicle = p_invoice->>'buyer_vehicle',
    payment_terms = p_invoice->>'payment_terms', due_date = nullif(p_invoice->>'due_date', '')::date,
    amount_received = coalesce(nullif(p_invoice->>'amount_received', '')::numeric, 0),
    payment_method = nullif(p_invoice->>'payment_method', ''), paid_to = nullif(p_invoice->>'paid_to', '')
  where id = p_id;
  if not found then raise exception 'Invoice not found'; end if;

  -- parts taken off the invoice go back on the shelf
  with removed as (
    delete from invoice_items
    where invoice_id = p_id
      and id not in (select (e->>'id')::uuid from jsonb_array_elements(p_items) e where nullif(e->>'id', '') is not null)
    returning part_id
  )
  update parts set status = 'Available', actual_price = null
  where id in (select part_id from removed) and status = 'Sold';

  for it in select * from jsonb_array_elements(p_items) loop
    if nullif(it->>'id', '') is not null then
      update invoice_items set part_id = it->>'part_id', description = it->>'description', category = it->>'category',
             hsn_sac = it->>'hsn_sac', qty = (it->>'qty')::int, taxable_value = (it->>'taxable_value')::numeric,
             gst_percent = (it->>'gst_percent')::numeric
      where id = (it->>'id')::uuid and invoice_id = p_id;
    else
      insert into invoice_items (invoice_id, part_id, description, category, hsn_sac, qty, taxable_value, gst_percent)
      values (p_id, it->>'part_id', it->>'description', it->>'category', it->>'hsn_sac',
              (it->>'qty')::int, (it->>'taxable_value')::numeric, (it->>'gst_percent')::numeric);
    end if;
    if p_mark_sold then
      update parts set status = 'Sold', actual_price = (it->>'taxable_value')::numeric * (it->>'qty')::int
      where id = it->>'part_id';
    end if;
  end loop;

  return jsonb_build_object('id', p_id);
end $$;

revoke all on function create_invoice(jsonb, jsonb, boolean) from public, anon;
revoke all on function update_invoice(uuid, jsonb, jsonb, boolean) from public, anon;
grant execute on function create_invoice(jsonb, jsonb, boolean) to authenticated;
grant execute on function update_invoice(uuid, jsonb, jsonb, boolean) to authenticated;
