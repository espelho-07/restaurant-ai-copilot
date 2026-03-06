-- Restaurant AI Copilot canonical schema
-- Safe to run multiple times in Supabase SQL editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- USERS ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists email text;
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users add column if not exists updated_at timestamptz not null default now();

-- RESTAURANTS ---------------------------------------------------------------
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  location text not null default '',
  cuisine text not null default '',
  phone text,
  uses_pos boolean not null default false,
  setup_complete boolean not null default false,
  pos_type text,
  pos_api_base_url text,
  pos_api_key text,
  pos_restaurant_id text,
  pos_secret_key text,
  pos_auto_sync boolean not null default false,
  pos_sync_interval_minutes int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurants add column if not exists id uuid default gen_random_uuid();
alter table public.restaurants add column if not exists user_id uuid;
alter table public.restaurants add column if not exists name text not null default '';
alter table public.restaurants add column if not exists location text not null default '';
alter table public.restaurants add column if not exists cuisine text not null default '';
alter table public.restaurants add column if not exists phone text;
alter table public.restaurants add column if not exists uses_pos boolean not null default false;
alter table public.restaurants add column if not exists setup_complete boolean not null default false;
alter table public.restaurants add column if not exists pos_type text;
alter table public.restaurants add column if not exists pos_api_base_url text;
alter table public.restaurants add column if not exists pos_api_key text;
alter table public.restaurants add column if not exists pos_restaurant_id text;
alter table public.restaurants add column if not exists pos_secret_key text;
alter table public.restaurants add column if not exists pos_auto_sync boolean not null default false;
alter table public.restaurants add column if not exists pos_sync_interval_minutes int not null default 5;
alter table public.restaurants add column if not exists created_at timestamptz not null default now();
alter table public.restaurants add column if not exists updated_at timestamptz not null default now();

update public.restaurants
set id = gen_random_uuid()
where id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurants_pkey'
  ) then
    alter table public.restaurants add constraint restaurants_pkey primary key (id);
  end if;
end
$$;

-- MENU_ITEMS ----------------------------------------------------------------
create table if not exists public.menu_items (
  id bigserial primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_name text not null,
  selling_price numeric(12, 2) not null default 0,
  food_cost numeric(12, 2) not null default 0,
  category text not null default 'General',
  aliases jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_items add column if not exists id bigserial;
alter table public.menu_items add column if not exists restaurant_id uuid;
alter table public.menu_items add column if not exists item_name text;
alter table public.menu_items add column if not exists selling_price numeric(12, 2) not null default 0;
alter table public.menu_items add column if not exists food_cost numeric(12, 2) not null default 0;
alter table public.menu_items add column if not exists category text not null default 'General';
alter table public.menu_items add column if not exists aliases jsonb;
alter table public.menu_items add column if not exists created_at timestamptz not null default now();
alter table public.menu_items add column if not exists updated_at timestamptz not null default now();

-- ORDERS --------------------------------------------------------------------
create table if not exists public.orders (
  id bigserial primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id text not null,
  item_name text not null,
  quantity int not null default 1,
  channel text not null default 'OFFLINE',
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists id bigserial;
alter table public.orders add column if not exists restaurant_id uuid;
alter table public.orders add column if not exists order_id text;
alter table public.orders add column if not exists item_name text;
alter table public.orders add column if not exists quantity int not null default 1;
alter table public.orders add column if not exists channel text not null default 'OFFLINE';
alter table public.orders add column if not exists timestamp timestamptz not null default now();
alter table public.orders add column if not exists created_at timestamptz not null default now();

-- CHANNELS ------------------------------------------------------------------
create table if not exists public.channels (
  id bigserial primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  commission_percentage numeric(5, 2) not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

alter table public.channels add column if not exists id bigserial;
alter table public.channels add column if not exists restaurant_id uuid;
alter table public.channels add column if not exists name text;
alter table public.channels add column if not exists commission_percentage numeric(5, 2) not null default 0;
alter table public.channels add column if not exists enabled boolean not null default true;
alter table public.channels add column if not exists created_at timestamptz not null default now();
alter table public.channels add column if not exists updated_at timestamptz not null default now();

-- CALL_LOGS -----------------------------------------------------------------
create table if not exists public.call_logs (
  id bigint generated always as identity primary key,
  call_sid text unique not null,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  caller_phone text,
  to_phone text,
  language text,
  status text,
  transcript jsonb,
  detected_items jsonb,
  order_json jsonb,
  order_id text,
  total numeric,
  is_transferred boolean not null default false,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.call_logs add column if not exists id bigint generated by default as identity;
alter table public.call_logs add column if not exists call_sid text;
alter table public.call_logs add column if not exists restaurant_id uuid;
alter table public.call_logs add column if not exists caller_phone text;
alter table public.call_logs add column if not exists to_phone text;
alter table public.call_logs add column if not exists language text;
alter table public.call_logs add column if not exists status text;
alter table public.call_logs add column if not exists transcript jsonb;
alter table public.call_logs add column if not exists detected_items jsonb;
alter table public.call_logs add column if not exists order_json jsonb;
alter table public.call_logs add column if not exists order_id text;
alter table public.call_logs add column if not exists total numeric;
alter table public.call_logs add column if not exists is_transferred boolean not null default false;
alter table public.call_logs add column if not exists started_at timestamptz;
alter table public.call_logs add column if not exists created_at timestamptz not null default now();
alter table public.call_logs add column if not exists updated_at timestamptz not null default now();

-- FOREIGN KEYS (for existing tables missing constraints) --------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurants_user_id_fkey') then
    alter table public.restaurants
      add constraint restaurants_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
exception when others then null;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_items_restaurant_id_fkey') then
    alter table public.menu_items
      add constraint menu_items_restaurant_id_fkey
      foreign key (restaurant_id) references public.restaurants(id) on delete cascade;
  end if;
exception when others then null;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_restaurant_id_fkey') then
    alter table public.orders
      add constraint orders_restaurant_id_fkey
      foreign key (restaurant_id) references public.restaurants(id) on delete cascade;
  end if;
exception when others then null;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'channels_restaurant_id_fkey') then
    alter table public.channels
      add constraint channels_restaurant_id_fkey
      foreign key (restaurant_id) references public.restaurants(id) on delete cascade;
  end if;
exception when others then null;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'call_logs_restaurant_id_fkey') then
    alter table public.call_logs
      add constraint call_logs_restaurant_id_fkey
      foreign key (restaurant_id) references public.restaurants(id) on delete cascade;
  end if;
exception when others then null;
end
$$;

-- UNIQUE / INDEXES ----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'channels_restaurant_id_name_key') then
    alter table public.channels add constraint channels_restaurant_id_name_key unique (restaurant_id, name);
  end if;
exception when others then null;
end
$$;

create unique index if not exists idx_restaurants_user_unique on public.restaurants(user_id);
create index if not exists idx_restaurants_user_id on public.restaurants(user_id);
create index if not exists idx_restaurants_phone on public.restaurants(phone);

create index if not exists idx_menu_items_restaurant_id on public.menu_items(restaurant_id);
create index if not exists idx_menu_items_name on public.menu_items(restaurant_id, item_name);

create index if not exists idx_orders_restaurant_timestamp on public.orders(restaurant_id, timestamp desc);
create index if not exists idx_orders_order_id on public.orders(restaurant_id, order_id);
create index if not exists idx_orders_channel on public.orders(restaurant_id, channel);

create index if not exists idx_channels_restaurant_id on public.channels(restaurant_id);
create index if not exists idx_channels_name on public.channels(name);

create unique index if not exists idx_call_logs_call_sid on public.call_logs(call_sid);
create index if not exists idx_call_logs_restaurant_started_at on public.call_logs(restaurant_id, started_at desc);

-- UPDATED_AT triggers -------------------------------------------------------
drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_restaurants_set_updated_at on public.restaurants;
create trigger trg_restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

drop trigger if exists trg_menu_items_set_updated_at on public.menu_items;
create trigger trg_menu_items_set_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_channels_set_updated_at on public.channels;
create trigger trg_channels_set_updated_at
before update on public.channels
for each row execute function public.set_updated_at();

drop trigger if exists trg_call_logs_set_updated_at on public.call_logs;
create trigger trg_call_logs_set_updated_at
before update on public.call_logs
for each row execute function public.set_updated_at();

-- DEFAULT CHANNELS ----------------------------------------------------------
create or replace function public.seed_default_channels(p_restaurant_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.channels (restaurant_id, name, commission_percentage, enabled)
  values
    (p_restaurant_id, 'OFFLINE', 0, true),
    (p_restaurant_id, 'ZOMATO', 25, true),
    (p_restaurant_id, 'SWIGGY', 25, true),
    (p_restaurant_id, 'CALL', 0, true)
  on conflict (restaurant_id, name) do update
  set commission_percentage = excluded.commission_percentage,
      enabled = excluded.enabled;
end;
$$;

create or replace function public.seed_default_channels_on_restaurant_insert()
returns trigger
language plpgsql
as $$
begin
  perform public.seed_default_channels(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_default_channels on public.restaurants;
create trigger trg_seed_default_channels
after insert on public.restaurants
for each row execute function public.seed_default_channels_on_restaurant_insert();

-- Backfill defaults for existing restaurants.
insert into public.channels (restaurant_id, name, commission_percentage, enabled)
select r.id, v.name, v.commission_percentage, true
from public.restaurants r
cross join (
  values
    ('OFFLINE'::text, 0::numeric),
    ('ZOMATO'::text, 25::numeric),
    ('SWIGGY'::text, 25::numeric),
    ('CALL'::text, 0::numeric)
) as v(name, commission_percentage)
on conflict (restaurant_id, name) do update
set commission_percentage = excluded.commission_percentage,
    enabled = excluded.enabled;

-- MULTI-RESTAURANT + DELIVERY EXTENSIONS -------------------------------------
alter table public.restaurants add column if not exists city text not null default '';
alter table public.restaurants add column if not exists area text not null default '';
alter table public.restaurants add column if not exists total_orders int not null default 0;

alter table public.orders add column if not exists order_number int;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists city text;
alter table public.orders add column if not exists pincode text;
alter table public.orders add column if not exists food_total numeric(12, 2) not null default 0;
alter table public.orders add column if not exists delivery_charge numeric(12, 2) not null default 0;
alter table public.orders add column if not exists total_amount numeric(12, 2) not null default 0;
alter table public.orders add column if not exists pos_order_ref text;

create index if not exists idx_restaurants_city on public.restaurants(city);
drop index if exists idx_restaurants_city_rating;
create index if not exists idx_restaurants_city_orders on public.restaurants(city, total_orders desc);
create index if not exists idx_orders_order_number on public.orders(restaurant_id, order_number desc);
create index if not exists idx_orders_city on public.orders(city);
