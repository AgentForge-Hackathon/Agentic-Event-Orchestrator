-- Itinerary table: one row per AI-generated plan, scoped to a user.
-- created_by references profiles(id) so we can query all plans per user.
create table public.itinerary (
  id                   uuid            primary key default gen_random_uuid(),
  created_by           uuid            not null references public.profiles (id) on delete cascade,

  summary              text,

  -- aggregated cost across all items
  total_cost_min       numeric(10, 2),
  total_cost_max       numeric(10, 2),
  total_cost_currency  text            not null default 'SGD',

  -- lifecycle
  status               text            not null default 'draft',

  -- audit
  created_at           timestamptz     not null default now(),
  updated_at           timestamptz     not null default now()
);

create index itinerary_created_by_idx on public.itinerary (created_by);
create index itinerary_status_idx     on public.itinerary (status);

alter table public.itinerary enable row level security;

-- ---------------------------------------------------------------------------

-- Itinerary items table: one row per event slot inside an itinerary.
-- event_snapshot (jsonb) captures the event state at planning time so
-- the itinerary stays accurate even if the live event record changes later.
create table public.itinerary_items (
  id              uuid            primary key default gen_random_uuid(),
  itinerary_id    uuid            not null references public.itinerary (id) on delete cascade,

  -- soft FK — allows the source event to be removed without breaking saved itineraries
  event_id        text            references public.events (id) on delete set null,

  -- full event snapshot captured at plan-generation time
  event_snapshot  jsonb           not null,

  -- scheduled window (may differ from the event's own start/end times)
  time_start      timestamptz,
  time_end        timestamptz,

  notes           text,
  sort_order      integer         not null default 0,

  created_at      timestamptz     not null default now()
);

create index itinerary_items_itinerary_id_idx on public.itinerary_items (itinerary_id);
create index itinerary_items_event_id_idx     on public.itinerary_items (event_id);

alter table public.itinerary_items enable row level security;
