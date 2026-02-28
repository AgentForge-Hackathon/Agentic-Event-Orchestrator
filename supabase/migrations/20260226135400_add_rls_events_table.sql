-- Events are a public catalogue — any authenticated or anonymous user can read.
-- Only the service role (backend scraper) may insert / update / delete.

-- Allow all users (including anonymous) to read events
create policy "Anyone can view events"
on public.events
for select
using (true);

-- Only service role can write (enforced by withhold on anon/authenticated roles)
-- No insert/update/delete policies for anon or authenticated intentionally.
