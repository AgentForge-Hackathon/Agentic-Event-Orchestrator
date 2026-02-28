-- Events table: stores scraped events from all discovery sources.
-- These are global (not user-scoped) — all users see the same event catalogue.
create table public.events (
  id                text            primary key,              -- external source ID, e.g. "evt_eb_12345"
  name              text            not null,
  description       text,
  url               text,
  image             text,
  venue             text,

  -- location (flat columns for easy querying + indexing)
  location_address  text,
  location_lat      numeric(9, 6),
  location_lng      numeric(9, 6),
  location_city     text,
  location_country  text,

  -- timing
  start_time        timestamptz,
  end_time          timestamptz,

  -- pricing (null = free or unknown)
  price_min         numeric(10, 2),
  price_max         numeric(10, 2),
  price_currency    text            not null default 'SGD',

  -- classification
  category          text,
  tags              text[]          not null default '{}',

  -- quality signals
  rating            numeric(3, 1),
  availability      text            not null default 'unknown',

  -- origin
  source            text            not null,

  -- audit
  created_at        timestamptz     not null default now(),
  updated_at        timestamptz     not null default now()
);

-- Indexes for common query patterns
create index events_category_idx     on public.events (category);
create index events_start_time_idx   on public.events (start_time);
create index events_availability_idx on public.events (availability);
create index events_source_idx       on public.events (source);

-- Enable RLS (policies added in separate migration)
alter table public.events enable row level security;
