-- ============================================
-- Parts Garage / Yardline — full schema
-- Run this once in Supabase SQL Editor
-- ============================================

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text unique not null,
  make text,
  model text,
  car_name text not null,
  year text,
  vin text,
  fuel_type text check (fuel_type in ('Petrol','Diesel','CNG','Electric','Hybrid')),
  transmission text check (transmission in ('Manual','Automatic')),
  purchase_date date,
  status text not null default 'In dismantling'
    check (status in ('In dismantling','Inventory complete','Fully sold','Closed')),
  fully_sold_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_vehicles_reg on vehicles (registration_number);

create table parts (
  id text primary key,
  vehicle_id uuid references vehicles(id) on delete restrict, -- nullable: standalone parts have no vehicle
  name text not null,
  part_number text,
  hsn_sac text,
  compatible_models text,
  category text not null check (category in (
    'Mechanical','Electrical','Engine components','Transmission','Suspension',
    'Brakes','Body parts','Interior','Cooling system','AC components',
    'Wheels & tyres','Miscellaneous'
  )),
  condition text not null check (condition in ('Good','Fair','Poor')),
  quantity int not null default 1,
  storage_location text,
  expected_price numeric(10,2) default 0,
  min_price numeric(10,2),
  actual_price numeric(10,2),
  status text not null default 'Available'
    check (status in ('Available','Reserved','Sold','Scrap','Under Testing','Returned')),
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_parts_vehicle on parts (vehicle_id);
create index idx_parts_status on parts (status);
create index idx_parts_archived on parts (archived);

-- ============================================
-- Media — belongs to EITHER a vehicle OR a part, never both, never neither.
-- A vehicle-linked row is the car's own photo/video gallery.
-- A part-linked row covers both a part pulled from a car (the parts row
-- still has its own vehicle_id set) and a standalone part (vehicle_id null).
-- ============================================
create table media (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete restrict,
  part_id text references parts(id) on delete restrict,
  type text not null check (type in ('image', 'video')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint media_one_parent check (
    (vehicle_id is not null and part_id is null) or
    (vehicle_id is null and part_id is not null)
  )
);

create index idx_media_vehicle on media (vehicle_id);
create index idx_media_part on media (part_id);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete restrict, -- null = business-wide
  category text not null check (category in (
    'Purchase','Transport','Towing','Dismantling','Repairs','Testing',
    'Labour','Rent','Electricity','Packaging','Delivery','Marketing','Tools','Miscellaneous'
  )),
  amount numeric(10,2) not null,
  expense_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index idx_expenses_vehicle on expenses (vehicle_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  invoice_date date not null default current_date,
  place_of_supply text,
  buyer_name text not null,
  buyer_phone text,
  buyer_gstin text,
  buyer_vehicle text,
  buyer_state text,
  payment_terms text,
  due_date date,
  amount_received numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete restrict,
  part_id text not null references parts(id) on delete restrict,
  description text not null,
  category text,
  hsn_sac text,
  qty int not null default 1,
  taxable_value numeric(10,2) not null,
  gst_percent numeric(4,2) not null default 18
);

create index idx_invoice_items_invoice on invoice_items (invoice_id);
create index idx_invoice_items_part on invoice_items (part_id);

-- ============================================
-- Vehicle-wise profit & recovery view
-- ============================================
create view vehicle_profit as
select
  v.id,
  v.registration_number,
  v.car_name,
  coalesce(e.total_investment, 0) as total_investment,
  coalesce(p.total_revenue, 0) as total_revenue_recovered,
  coalesce(e.total_investment, 0) - coalesce(p.total_revenue, 0) as remaining_recovery,
  coalesce(p.total_revenue, 0) - coalesce(e.total_investment, 0) as gross_profit
from vehicles v
left join (
  select vehicle_id, sum(amount) as total_investment
  from expenses group by vehicle_id
) e on e.vehicle_id = v.id
left join (
  select vehicle_id, sum(actual_price) as total_revenue
  from parts where status = 'Sold' group by vehicle_id
) p on p.vehicle_id = v.id;

-- ============================================
-- Public inventory view — what customers are allowed to see.
-- Unsold only (Available/Reserved, not archived), and strips the
-- negotiation floor (min_price) and the sold price (actual_price) so
-- nothing internal leaks through the shared inventory link.
-- Views run with the owner's privileges by default (not the caller's),
-- so this stays readable by the public "anon" role even though the
-- underlying `parts` table itself is authenticated-only.
-- ============================================
create view parts_public as
select
  id, vehicle_id, name, part_number, category, condition,
  quantity, expected_price, status, created_at
from parts
where status in ('Available', 'Reserved') and archived = false;

grant select on parts_public to anon, authenticated;

-- ============================================
-- Sold parts ledger — same underlying rows as `parts`, just a dedicated,
-- pre-filtered place to look at what's sold for record-keeping. Nothing is
-- copied or duplicated, so invoice history and the profit view above never
-- fall out of sync with it.
-- ============================================
create view sold_parts_ledger as
select * from parts where status = 'Sold';

grant select on sold_parts_ledger to authenticated;

-- ============================================
-- Auto-stamp fully_sold_at when every part on a vehicle is Sold/Scrap
-- ============================================
create or replace function check_vehicle_fully_sold()
returns trigger as $$
begin
  update vehicles v
  set fully_sold_at = case
    when not exists (
      select 1 from parts p
      where p.vehicle_id = v.id and p.archived = false
      and p.status not in ('Sold', 'Scrap')
    ) and v.fully_sold_at is null then now()
    else v.fully_sold_at
  end
  where v.id = new.vehicle_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_check_fully_sold
after update on parts
for each row execute function check_vehicle_fully_sold();

-- ============================================
-- Row Level Security
-- ============================================
alter table vehicles enable row level security;
alter table media enable row level security;
alter table parts enable row level security;
alter table expenses enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;

-- Public read on vehicles + media only (needed for the WhatsApp gallery link
-- and the shared inventory page). `parts` itself stays authenticated-only —
-- public access to part data goes through the `parts_public` view above.
create policy "Public can read vehicles" on vehicles for select using (true);
create policy "Public can read media" on media for select using (true);

-- Everything else, including writes to vehicles/media, is admin-only
create policy "Authenticated can read parts" on parts for select to authenticated using (true);
create policy "Authenticated can read expenses" on expenses for select to authenticated using (true);
create policy "Authenticated can read invoices" on invoices for select to authenticated using (true);
create policy "Authenticated can read invoice_items" on invoice_items for select to authenticated using (true);

create policy "Authenticated can insert vehicles" on vehicles for insert to authenticated with check (true);
create policy "Authenticated can update vehicles" on vehicles for update to authenticated using (true);
create policy "Authenticated can insert media" on media for insert to authenticated with check (true);
create policy "Authenticated can insert parts" on parts for insert to authenticated with check (true);
create policy "Authenticated can update parts" on parts for update to authenticated using (true);
create policy "Authenticated can insert expenses" on expenses for insert to authenticated with check (true);
create policy "Authenticated can insert invoices" on invoices for insert to authenticated with check (true);
create policy "Authenticated can update invoices" on invoices for update to authenticated using (true);
create policy "Authenticated can insert invoice_items" on invoice_items for insert to authenticated with check (true);
