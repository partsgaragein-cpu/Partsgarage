-- Migration 006 — Safe to re-run. Adds only; no existing data is changed or removed.
-- 1) Expenses can be edited after creation (edits are recorded in the Activity log).
-- 2) A car can be registered together with its first expense in ONE all-or-nothing step.

drop policy if exists "Authenticated can update expenses" on expenses;
create policy "Authenticated can update expenses" on expenses
  for update to authenticated using (true) with check (true);

create or replace function create_vehicle_with_expense(p_vehicle jsonb, p_expense jsonb default null)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id uuid; v_reg text;
begin
  insert into vehicles (registration_number, make, model, car_name, year, vin, fuel_type, transmission, purchase_date, status)
  values (upper(btrim(p_vehicle->>'registration_number')), p_vehicle->>'make', p_vehicle->>'model', p_vehicle->>'car_name',
          p_vehicle->>'year', p_vehicle->>'vin', p_vehicle->>'fuel_type', p_vehicle->>'transmission',
          nullif(p_vehicle->>'purchase_date', '')::date, coalesce(nullif(p_vehicle->>'status', ''), 'In dismantling'))
  returning id, registration_number into v_id, v_reg;

  if p_expense is not null and coalesce(nullif(p_expense->>'amount', '')::numeric, 0) > 0 then
    insert into expenses (vehicle_id, category, amount, expense_date, note)
    values (v_id, btrim(p_expense->>'category'), (p_expense->>'amount')::numeric,
            coalesce(nullif(p_expense->>'expense_date', '')::date, current_date), nullif(p_expense->>'note', ''));
  end if;

  return jsonb_build_object('id', v_id, 'registration_number', v_reg);
end $$;

revoke all on function create_vehicle_with_expense(jsonb, jsonb) from public, anon;
grant execute on function create_vehicle_with_expense(jsonb, jsonb) to authenticated;
