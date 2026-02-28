-- Itinerary: users can only read and write their own rows.

create policy "Users can view own itineraries"
on public.itinerary
for select
using (auth.uid() = created_by);

create policy "Users can insert own itineraries"
on public.itinerary
for insert
with check (auth.uid() = created_by);

create policy "Users can update own itineraries"
on public.itinerary
for update
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

create policy "Users can delete own itineraries"
on public.itinerary
for delete
using (auth.uid() = created_by);

-- ---------------------------------------------------------------------------

-- Itinerary items: access is inherited from the parent itinerary.
-- A user can only touch items that belong to an itinerary they own.

create policy "Users can view own itinerary items"
on public.itinerary_items
for select
using (
  exists (
    select 1 from public.itinerary
    where itinerary.id = itinerary_items.itinerary_id
      and itinerary.created_by = auth.uid()
  )
);

create policy "Users can insert own itinerary items"
on public.itinerary_items
for insert
with check (
  exists (
    select 1 from public.itinerary
    where itinerary.id = itinerary_items.itinerary_id
      and itinerary.created_by = auth.uid()
  )
);

create policy "Users can update own itinerary items"
on public.itinerary_items
for update
using (
  exists (
    select 1 from public.itinerary
    where itinerary.id = itinerary_items.itinerary_id
      and itinerary.created_by = auth.uid()
  )
);

create policy "Users can delete own itinerary items"
on public.itinerary_items
for delete
using (
  exists (
    select 1 from public.itinerary
    where itinerary.id = itinerary_items.itinerary_id
      and itinerary.created_by = auth.uid()
  )
);
