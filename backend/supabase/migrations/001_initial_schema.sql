-- Run this migration in the Supabase SQL Editor before starting database-backed API work.

create table public.tracked_products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  product_url text not null unique,
  store_product_id text,
  image_url text,
  current_price numeric(12, 2) check (current_price is null or current_price > 0),
  current_stock text check (current_stock is null or current_stock in ('in_stock', 'out_of_stock')),
  last_scraped_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references public.tracked_products(id) on delete cascade,
  price numeric(12, 2) not null check (price > 0),
  stock_status text not null check (stock_status in ('in_stock', 'out_of_stock')),
  scraped_at timestamptz not null default now()
);

create table public.scrape_logs (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references public.tracked_products(id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz,
  attempt_number integer not null check (attempt_number >= 1),
  status text not null check (status in ('success', 'retried', 'failed')),
  error_message text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index price_history_product_scraped_at_idx
  on public.price_history (tracked_product_id, scraped_at desc);

create index scrape_logs_product_started_at_idx
  on public.scrape_logs (tracked_product_id, started_at desc);

create index tracked_products_active_idx
  on public.tracked_products (is_active)
  where is_active = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tracked_products_set_updated_at
before update on public.tracked_products
for each row
execute function public.set_updated_at();
