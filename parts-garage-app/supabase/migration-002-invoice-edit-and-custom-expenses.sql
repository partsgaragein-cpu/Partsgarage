-- Migration 002 — run once in Supabase → SQL Editor (safe to re-run).
-- 1) Invoices: how the money was paid and who received it
-- 2) Invoice items: allow editing (update) and removing (delete) lines on an invoice
-- 3) Expenses: allow your own category names (drops the fixed-list rule)

-- 1) payment method + received-by on invoices
alter table invoices add column if not exists payment_method text;
alter table invoices add column if not exists paid_to text;

alter table invoices drop constraint if exists invoices_payment_method_check;
alter table invoices add constraint invoices_payment_method_check
  check (payment_method is null or payment_method in ('Cash','Online'));

alter table invoices drop constraint if exists invoices_paid_to_check;
alter table invoices add constraint invoices_paid_to_check
  check (paid_to is null or paid_to in ('Sarthak','Sunny'));

-- 2) editing invoice lines (invoices themselves still cannot be deleted)
drop policy if exists "Authenticated can update invoice_items" on invoice_items;
create policy "Authenticated can update invoice_items" on invoice_items
  for update to authenticated using (true);

drop policy if exists "Authenticated can delete invoice_items" on invoice_items;
create policy "Authenticated can delete invoice_items" on invoice_items
  for delete to authenticated using (true);

-- 3) custom expense categories: drop whatever CHECK rule limits expenses.category
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.expenses drop constraint %I', c);
  end loop;
end $$;

alter table expenses drop constraint if exists expenses_category_not_blank;
alter table expenses add constraint expenses_category_not_blank
  check (length(btrim(category)) > 0);
