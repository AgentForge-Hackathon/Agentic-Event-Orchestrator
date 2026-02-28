-- =============================================================================
-- Seed: Events
-- 15 realistic Singapore events across diverse categories.
-- Safe to re-run: ON CONFLICT DO NOTHING skips existing rows.
-- =============================================================================

insert into public.events (
  id, name, description, url, image,
  venue, location_address, location_lat, location_lng, location_city, location_country,
  start_time, end_time,
  price_min, price_max, price_currency,
  category, tags, rating, availability, source
) values

-- 1. Jazz Night ---------------------------------------------------------------
(
  'evt_sg_001',
  'Jazz Night at Marina Bay Sands',
  'An enchanting evening of live jazz featuring top local and regional artists performing classic standards and original compositions, paired with a curated dinner menu and sweeping views of the marina skyline.',
  'https://www.marinabaysands.com/entertainment/jazz-night.html',
  'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&auto=format&fit=crop',
  'Marina Bay Sands Sky Park',
  '10 Bayfront Avenue, Singapore 018956',
  1.283700, 103.860700,
  'Singapore', 'SG',
  '2026-03-07T19:00:00+08:00', '2026-03-07T22:00:00+08:00',
  80, 150, 'SGD',
  'Concert',
  ARRAY['music', 'jazz', 'dining', 'rooftop', 'live-music'],
  4.7, 'available', 'seed'
),

-- 2. Singapore Night Festival --------------------------------------------------
(
  'evt_sg_002',
  'Singapore Night Festival 2026',
  'An annual after-dark celebration in the Bras Basah.Bugis precinct featuring large-scale light art installations, live performances, and pop-up markets. Free and open to all.',
  'https://www.singaporenightfestival.sg',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&auto=format&fit=crop',
  'National Museum of Singapore',
  '93 Stamford Road, Singapore 178897',
  1.296800, 103.848600,
  'Singapore', 'SG',
  '2026-03-08T19:00:00+08:00', '2026-03-08T23:59:00+08:00',
  0, 0, 'SGD',
  'Festival',
  ARRAY['festival', 'free', 'art', 'lights', 'family-friendly', 'outdoor'],
  4.8, 'available', 'seed'
),

-- 3. Chinatown Night Market ----------------------------------------------------
(
  'evt_sg_003',
  'Chinatown Food Trail & Night Market',
  'A guided evening walk through Chinatown''s iconic hawker stalls and heritage shophouses, sampling char kway teow, roast meats, and traditional desserts. Ends with a curated market of local artisans.',
  'https://www.chinatown.sg/events/food-trail',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop',
  'Chinatown Complex',
  '335 Smith Street, Singapore 050335',
  1.281800, 103.843800,
  'Singapore', 'SG',
  '2026-03-08T17:00:00+08:00', '2026-03-08T21:00:00+08:00',
  30, 60, 'SGD',
  'Dining',
  ARRAY['food', 'hawker', 'heritage', 'guided-tour', 'night-market', 'cultural'],
  4.5, 'available', 'seed'
),

-- 4. Stand-Up Comedy ----------------------------------------------------------
(
  'evt_sg_004',
  'LOL Comedy Night — Singapore Roast',
  'Singapore''s best stand-up comedians go head-to-head in a night of irreverent humour roasting everything from MRT delays to the housing market. Doors open at 7 PM, show starts 8 PM.',
  'https://www.comedyclub.asia/events/lol-roast',
  'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&auto=format&fit=crop',
  'The Underground Comedy Club',
  '3B River Valley Road, Clarke Quay, Singapore 179021',
  1.290600, 103.845700,
  'Singapore', 'SG',
  '2026-03-13T20:00:00+08:00', '2026-03-13T22:30:00+08:00',
  40, 60, 'SGD',
  'Theatre',
  ARRAY['comedy', 'stand-up', 'nightlife', 'adults-only', 'indoor'],
  4.4, 'available', 'eventbrite'
),

-- 5. Sunrise Yoga at Gardens --------------------------------------------------
(
  'evt_sg_005',
  'Sunrise Yoga at Gardens by the Bay',
  'Start your weekend right with an energising 75-minute yoga session on the outdoor lawn as the sun rises over the Supertrees. Suitable for all levels. Bring your own mat.',
  'https://www.gardensbythebay.com.sg/events/sunrise-yoga',
  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop',
  'Gardens by the Bay — Supertree Grove Lawn',
  '18 Marina Gardens Drive, Singapore 018953',
  1.281400, 103.863400,
  'Singapore', 'SG',
  '2026-03-14T06:30:00+08:00', '2026-03-14T08:00:00+08:00',
  0, 0, 'SGD',
  'Outdoor',
  ARRAY['yoga', 'wellness', 'free', 'morning', 'outdoor', 'all-levels'],
  4.6, 'available', 'seed'
),

-- 6. National Gallery Exhibition ----------------------------------------------
(
  'evt_sg_006',
  'Between Worlds: Southeast Asian Contemporary Art',
  'A major group exhibition bringing together over 60 works by 25 emerging and mid-career Southeast Asian artists exploring themes of identity, migration, and belonging. Includes guided tours every Saturday.',
  'https://www.nationalgallery.sg/exhibitions/between-worlds',
  'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&auto=format&fit=crop',
  'National Gallery Singapore',
  '1 St Andrew''s Road, Singapore 178957',
  1.289900, 103.851000,
  'Singapore', 'SG',
  '2026-03-01T10:00:00+08:00', '2026-04-30T19:00:00+08:00',
  10, 25, 'SGD',
  'Exhibition',
  ARRAY['art', 'exhibition', 'contemporary', 'southeast-asia', 'culture', 'indoor'],
  4.7, 'available', 'seed'
),

-- 7. Salsa Dance Workshop -----------------------------------------------------
(
  'evt_sg_007',
  'Salsa & Bachata Masterclass',
  'Learn the basics of Cuban salsa and bachata in this high-energy, beginner-friendly 2-hour workshop. No partner required. Professional instructors guide you through footwork, timing, and social dancing.',
  'https://www.danceunlimited.sg/workshops/salsa-bachata',
  'https://images.unsplash.com/photo-1547153760-18fc86324498?w=800&auto=format&fit=crop',
  'Dance Unlimited Studio',
  '20 Tanjong Pagar Road, Singapore 088443',
  1.276600, 103.843400,
  'Singapore', 'SG',
  '2026-03-11T19:30:00+08:00', '2026-03-11T21:30:00+08:00',
  35, 50, 'SGD',
  'Workshop',
  ARRAY['dance', 'salsa', 'bachata', 'beginner', 'social', 'fitness'],
  4.6, 'available', 'eventbrite'
),

-- 8. Marina Bay Sunset Cruise -------------------------------------------------
(
  'evt_sg_008',
  'Marina Bay Sunset Cocktail Cruise',
  'Sail around Marina Bay and the Southern Islands aboard a classic wooden bumboat as the sun sets over the city skyline. Complimentary welcome cocktail and light bites included.',
  'https://www.marinacruises.sg/sunset-cruise',
  'https://images.unsplash.com/photo-1548372290-8d01b6c8e78c?w=800&auto=format&fit=crop',
  'Marina South Pier',
  '31 Marina Coastal Drive, Singapore 018988',
  1.271600, 103.862400,
  'Singapore', 'SG',
  '2026-03-14T17:30:00+08:00', '2026-03-14T19:30:00+08:00',
  60, 90, 'SGD',
  'Outdoor',
  ARRAY['cruise', 'sunset', 'cocktails', 'romantic', 'date-night', 'scenic'],
  4.5, 'limited', 'eventbrite'
),

-- 9. K-Pop Night --------------------------------------------------------------
(
  'evt_sg_009',
  'K-Pop Night: Dance & Karaoke Takeover',
  'Dance the night away to the hottest K-Pop anthems spun by DJ Oppa and two live vocal performances. Karaoke booths open from 9 PM. Dress code: K-Pop chic.',
  'https://www.zoukclub.com/events/kpop-night',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop',
  'Zouk Singapore',
  '3C River Valley Road, Singapore 179022',
  1.291000, 103.845500,
  'Singapore', 'SG',
  '2026-03-20T21:00:00+08:00', '2026-03-21T03:00:00+08:00',
  30, 50, 'SGD',
  'Nightlife',
  ARRAY['k-pop', 'dance', 'clubbing', 'karaoke', 'nightlife', 'music'],
  4.3, 'available', 'eventfinda'
),

-- 10. Maxwell Hawker Tour -----------------------------------------------------
(
  'evt_sg_010',
  'Maxwell Hawker Heritage Food Tour',
  'A 2.5-hour guided tour of Maxwell Food Centre and Tanjong Pagar Plaza with a knowledgeable local guide. Taste eight signature dishes — from Tian Tian Chicken Rice to Ah Balling Tang Yuan — while learning about Singapore hawker culture.',
  'https://www.eatwithlocals.sg/maxwell-heritage-tour',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop',
  'Maxwell Food Centre',
  '1 Kadayanallur Street, Singapore 069184',
  1.279800, 103.844600,
  'Singapore', 'SG',
  '2026-03-15T11:00:00+08:00', '2026-03-15T13:30:00+08:00',
  45, 65, 'SGD',
  'Dining',
  ARRAY['hawker', 'food-tour', 'heritage', 'guided', 'local', 'cultural'],
  4.9, 'available', 'eventbrite'
),

-- 11. Indie Film Screening ----------------------------------------------------
(
  'evt_sg_011',
  'Midnight Shorts: Asian Indie Cinema',
  'A curated programme of award-winning short films from Indonesia, Thailand, and Singapore, followed by a Q&A with two of the directors. Snacks and craft beer available at the bar.',
  'https://www.theprojector.sg/events/midnight-shorts',
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop',
  'The Projector',
  '6001 Beach Road, Golden Mile Tower #05-00, Singapore 199589',
  1.308700, 103.861600,
  'Singapore', 'SG',
  '2026-03-12T20:30:00+08:00', '2026-03-12T23:00:00+08:00',
  15, 20, 'SGD',
  'Cultural',
  ARRAY['film', 'indie', 'cinema', 'short-films', 'asian', 'qa'],
  4.5, 'available', 'eventfinda'
),

-- 12. Rooftop Cinema ----------------------------------------------------------
(
  'evt_sg_012',
  'Rooftop Cinema: La La Land Under the Stars',
  'Watch the Oscar-winning La La Land under the open sky on the rooftop of 1-Altitude, 282 metres above sea level. Bean bags, blankets, and a complimentary popcorn set included.',
  'https://www.1-altitude.com/events/rooftop-cinema',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop',
  '1-Altitude Gallery & Bar',
  '1 Raffles Place, #61-01, Singapore 048616',
  1.284200, 103.851300,
  'Singapore', 'SG',
  '2026-03-21T20:00:00+08:00', '2026-03-21T22:30:00+08:00',
  45, 65, 'SGD',
  'Cultural',
  ARRAY['cinema', 'rooftop', 'romantic', 'date-night', 'outdoor', 'movies'],
  4.6, 'available', 'eventbrite'
),

-- 13. TEDxSingapore -----------------------------------------------------------
(
  'evt_sg_013',
  'TEDxSingapore 2026 — Uncharted',
  'A full-day independently organised TED event featuring 12 speakers spanning technology, mental health, urban design, and the arts. Includes networking breaks and a post-event reception.',
  'https://www.tedxsingapore.sg/2026',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&auto=format&fit=crop',
  'The Capitol Theatre',
  '17-19 Stamford Road, Singapore 178907',
  1.293700, 103.849900,
  'Singapore', 'SG',
  '2026-03-28T09:00:00+08:00', '2026-03-28T18:00:00+08:00',
  80, 150, 'SGD',
  'Workshop',
  ARRAY['tedx', 'talks', 'inspiration', 'networking', 'tech', 'ideas'],
  4.8, 'limited', 'eventbrite'
),

-- 14. Night Run ---------------------------------------------------------------
(
  'evt_sg_014',
  'East Coast Night Run 5K & 10K',
  'A fun night run along the scenic East Coast Park Connector. Both 5K and 10K distances available. Race pack includes a finisher medal, hydration stops, and a post-run supper spread at the East Coast Lagoon Food Village.',
  'https://www.runsg.com/east-coast-night-run',
  'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&auto=format&fit=crop',
  'East Coast Park — Area F',
  'East Coast Park Area F, Singapore 449876',
  1.303100, 103.910200,
  'Singapore', 'SG',
  '2026-03-14T19:00:00+08:00', '2026-03-14T22:00:00+08:00',
  25, 45, 'SGD',
  'Outdoor',
  ARRAY['running', 'fitness', 'night-run', '5k', '10k', 'community'],
  4.3, 'available', 'eventfinda'
),

-- 15. Botanic Gardens Night Walk ----------------------------------------------
(
  'evt_sg_015',
  'Singapore Botanic Gardens — Lantern Night Walk',
  'A free guided walk through the UNESCO World Heritage Singapore Botanic Gardens after dark. Hundreds of paper lanterns illuminate the paths as rangers share stories about the garden''s 160-year history.',
  'https://www.nparks.gov.sg/sbg/events/lantern-walk',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop',
  'Singapore Botanic Gardens',
  '1 Cluny Road, Singapore 259569',
  1.313900, 103.815700,
  'Singapore', 'SG',
  '2026-03-15T19:30:00+08:00', '2026-03-15T21:30:00+08:00',
  0, 0, 'SGD',
  'Outdoor',
  ARRAY['nature', 'free', 'family-friendly', 'heritage', 'guided', 'evening'],
  4.7, 'available', 'seed'
)

on conflict (id) do nothing;


-- =============================================================================
-- Enable pgcrypto for gen_salt() / crypt() used in auth seed below
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;


-- =============================================================================
-- Seed: Auth Users
-- Two local-dev test accounts. Password for both is "password123".
-- Requires pgcrypto (enabled by default in Supabase local dev).
-- Commented out since we do not want to seed real auth users.
-- In Itinerary table, temporary used Jared's and Jeremy's UUID for the 2 Itinerary items
-- =============================================================================

-- insert into auth.users (
--   id, instance_id, aud, role,
--   email, encrypted_password, email_confirmed_at,
--   raw_app_meta_data, raw_user_meta_data,
--   created_at, updated_at
-- ) values
-- (
--   '11111111-1111-1111-1111-111111111111',
--   '00000000-0000-0000-0000-000000000000',
--   'authenticated', 'authenticated',
--   'alice@example.com',
--   crypt('password123', gen_salt('bf')),
--   now(),
--   '{"provider":"email","providers":["email"]}'::jsonb,
--   '{"name":"Alice Tan"}'::jsonb,
--   now(), now()
-- ),
-- (
--   '22222222-2222-2222-2222-222222222222',
--   '00000000-0000-0000-0000-000000000000',
--   'authenticated', 'authenticated',
--   'ben@example.com',
--   crypt('password123', gen_salt('bf')),
--   now(),
--   '{"provider":"email","providers":["email"]}'::jsonb,
--   '{"name":"Ben Lim"}'::jsonb,
--   now(), now()
-- )
-- on conflict (id) do nothing;


-- -- =============================================================================
-- -- Seed: Profiles
-- -- =============================================================================

-- insert into public.profiles (
--   id, name, travel_style, budget_range, interests, is_onboarded, created_at, updated_at
-- ) values
-- (
--   '11111111-1111-1111-1111-111111111111',
--   'Alice Tan',
--   'adventurous',
--   '80_to_150',
--   ARRAY['music', 'dining', 'nightlife', 'arts'],
--   true,
--   now(), now()
-- ),
-- (
--   '22222222-2222-2222-2222-222222222222',
--   'Ben Lim',
--   'relaxed',
--   '30_to_80',
--   ARRAY['culture', 'food', 'outdoor', 'exhibitions'],
--   true,
--   now(), now()
-- )
-- on conflict (id) do nothing;


-- =============================================================================
-- Seed: Itinerary
-- Two example plans, one per user.
-- =============================================================================

insert into public.itinerary (
  id, created_by, summary,
  total_cost_min, total_cost_max, total_cost_currency,
  status, created_at, updated_at
) values
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'd8e1db99-6136-41a0-9c8e-c8e7cb5ada5f',
  'A romantic Saturday evening at Marina Bay — sunset cocktail cruise followed by a jazz dinner under the stars.',
  140, 240, 'SGD',
  'draft',
  now(), now()
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'e7a6ca15-b08d-4902-908d-b6d80ace7a34',
  'A relaxed Sunday — contemporary art at the National Gallery followed by a hawker heritage food tour at Maxwell.',
  55, 90, 'SGD',
  'draft',
  now(), now()
)
on conflict (id) do nothing;


-- =============================================================================
-- Seed: Itinerary Items
-- event_snapshot captures the full event shape at planning time.
-- =============================================================================

insert into public.itinerary_items (
  id, itinerary_id, event_id, event_snapshot,
  time_start, time_end, notes, sort_order, created_at
) values

-- Alice — item 1: Sunset Cruise -----------------------------------------------
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'evt_sg_008',
  '{
    "id": "evt_sg_008",
    "name": "Marina Bay Sunset Cocktail Cruise",
    "description": "Sail around Marina Bay and the Southern Islands aboard a classic wooden bumboat as the sun sets over the city skyline. Complimentary welcome cocktail and light bites included.",
    "url": "https://www.marinacruises.sg/sunset-cruise",
    "image": "https://images.unsplash.com/photo-1548372290-8d01b6c8e78c?w=800&auto=format&fit=crop",
    "venue": "Marina South Pier",
    "location": { "address": "31 Marina Coastal Drive, Singapore 018988", "city": "Singapore", "country": "SG" },
    "startTime": "2026-03-14T17:30:00+08:00",
    "endTime": "2026-03-14T19:30:00+08:00",
    "price": { "min": 60, "max": 90, "currency": "SGD" },
    "category": "Outdoor",
    "tags": ["cruise", "sunset", "cocktails", "romantic", "date-night", "scenic"],
    "rating": 4.5,
    "availability": "limited",
    "source": "eventbrite"
  }'::jsonb,
  '2026-03-14T17:30:00+08:00',
  '2026-03-14T19:30:00+08:00',
  'Book the upper deck for the best views. Arrive 15 minutes early to board.',
  1,
  now()
),

-- Alice — item 2: Jazz Night --------------------------------------------------
(
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'evt_sg_001',
  '{
    "id": "evt_sg_001",
    "name": "Jazz Night at Marina Bay Sands",
    "description": "An enchanting evening of live jazz featuring top local and regional artists performing classic standards and original compositions, paired with a curated dinner menu and sweeping views of the marina skyline.",
    "url": "https://www.marinabaysands.com/entertainment/jazz-night.html",
    "image": "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&auto=format&fit=crop",
    "venue": "Marina Bay Sands Sky Park",
    "location": { "address": "10 Bayfront Avenue, Singapore 018956", "city": "Singapore", "country": "SG" },
    "startTime": "2026-03-14T20:00:00+08:00",
    "endTime": "2026-03-14T22:30:00+08:00",
    "price": { "min": 80, "max": 150, "currency": "SGD" },
    "category": "Concert",
    "tags": ["music", "jazz", "dining", "rooftop", "live-music"],
    "rating": 4.7,
    "availability": "available",
    "source": "seed"
  }'::jsonb,
  '2026-03-14T20:00:00+08:00',
  '2026-03-14T22:30:00+08:00',
  'Request a table near the stage. Order the tasting menu in advance for the full experience.',
  2,
  now()
),

-- Ben — item 1: Art Exhibition ------------------------------------------------
(
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'evt_sg_006',
  '{
    "id": "evt_sg_006",
    "name": "Between Worlds: Southeast Asian Contemporary Art",
    "description": "A major group exhibition bringing together over 60 works by 25 emerging and mid-career Southeast Asian artists exploring themes of identity, migration, and belonging.",
    "url": "https://www.nationalgallery.sg/exhibitions/between-worlds",
    "image": "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&auto=format&fit=crop",
    "venue": "National Gallery Singapore",
    "location": { "address": "1 St Andrew''s Road, Singapore 178957", "city": "Singapore", "country": "SG" },
    "startTime": "2026-03-15T10:00:00+08:00",
    "endTime": "2026-03-15T12:00:00+08:00",
    "price": { "min": 10, "max": 25, "currency": "SGD" },
    "category": "Exhibition",
    "tags": ["art", "exhibition", "contemporary", "southeast-asia", "culture", "indoor"],
    "rating": 4.7,
    "availability": "available",
    "source": "seed"
  }'::jsonb,
  '2026-03-15T10:00:00+08:00',
  '2026-03-15T12:00:00+08:00',
  'Join the Saturday guided tour at 11 AM for curator commentary on the key works.',
  1,
  now()
),

-- Ben — item 2: Maxwell Hawker Tour ------------------------------------------
(
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'evt_sg_010',
  '{
    "id": "evt_sg_010",
    "name": "Maxwell Hawker Heritage Food Tour",
    "description": "A 2.5-hour guided tour of Maxwell Food Centre and Tanjong Pagar Plaza with a knowledgeable local guide. Taste eight signature dishes while learning about Singapore hawker culture.",
    "url": "https://www.eatwithlocals.sg/maxwell-heritage-tour",
    "image": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop",
    "venue": "Maxwell Food Centre",
    "location": { "address": "1 Kadayanallur Street, Singapore 069184", "city": "Singapore", "country": "SG" },
    "startTime": "2026-03-15T13:00:00+08:00",
    "endTime": "2026-03-15T15:30:00+08:00",
    "price": { "min": 45, "max": 65, "currency": "SGD" },
    "category": "Dining",
    "tags": ["hawker", "food-tour", "heritage", "guided", "local", "cultural"],
    "rating": 4.9,
    "availability": "available",
    "source": "eventbrite"
  }'::jsonb,
  '2026-03-15T13:00:00+08:00',
  '2026-03-15T15:30:00+08:00',
  'Wear comfortable shoes and bring cash — most hawker stalls are cash-only.',
  2,
  now()
)

on conflict (id) do nothing;
