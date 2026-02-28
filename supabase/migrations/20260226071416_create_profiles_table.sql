create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  travel_style text,
  budget_range text,
  interests text[],
  is_onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;