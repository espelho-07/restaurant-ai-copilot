-- Core schema for AI Restaurant Copilot
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists restaurants (
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

create index if not exists idx_restaurants_user_id on restaurants(user_id);
create index if not exists idx_restaurants_phone on restaurants(phone);

create table if not exists menu_items (
  id bigserial primary key,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  item_name text not null,
  category text not null default 'General',
  selling_price numeric(12,2) not null default 0,
  food_cost numeric(12,2) not null default 0,
  aliases jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_menu_items_restaurant_id on menu_items(restaurant_id);
create index if not exists idx_menu_items_name on menu_items(restaurant_id, item_name);

create table if not exists orders (
  id bigserial primary key,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  order_id text not null,
  item_name text not null,
  quantity int not null default 1,
  channel text not null default 'OFFLINE',
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_restaurant_timestamp on orders(restaurant_id, timestamp desc);
create index if not exists idx_orders_order_id on orders(restaurant_id, order_id);

create table if not exists channels (
  id bigserial primary key,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  commission_percentage numeric(5,2) not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id, name)
);

create table if not exists call_logs (
  id bigint generated always as identity primary key,
  call_sid text unique not null,
  restaurant_id uuid references restaurants(id) on delete cascade,
  caller_phone text,
  to_phone text,
  language text,
  status text,
  transcript jsonb,
  order_json jsonb,
  order_id text,
  total numeric,
  is_transferred boolean not null default false,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_call_logs_restaurant_started_at
  on call_logs (restaurant_id, started_at desc);
