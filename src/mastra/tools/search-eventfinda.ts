import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { EventCategorySchema } from '../../types/index.js';
import type { Event, EventCategory } from '../../types/index.js';
import {
  inferCategoryFromEventFinda,
  CATEGORY_TO_EVENTFINDA_SLUG,
} from './utils/category.js';

// ============================================
// EventFinda API Configuration
// ============================================

/**
 * EventFinda v2 REST API — https://www.eventfinda.sg/api/v2/overview
 *
 * Auth: HTTP Basic (username:password)
 * Base URL: https://api.eventfinda.sg/v2
 * Endpoint: GET /events.json
 * Rate limit: 1 request/second
 * Max rows per request: 20
 */
const EVENTFINDA_API_BASE = 'https://api.eventfinda.sg/v2';

// Singapore center point for distance-based queries
const SINGAPORE_CENTER = { lat: 1.3521, lng: 103.8198 };

// ============================================
// Retry Configuration
// ============================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1100; // >1s to respect 1 req/sec rate limit

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a fetch call with retry logic and exponential backoff.
 * Specifically handles:
 *   - 429 Too Many Requests (rate limited) — waits longer
 *   - 5xx Server Errors — retries with backoff
 *   - Network errors — retries with backoff
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, init);

      // Success — return immediately
      if (response.ok) return response;

      // Rate limited — wait and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[eventfinda] Rate limited (429), retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(waitMs);
        continue;
      }

      // Server error — retry with backoff
      if (response.status >= 500) {
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[eventfinda] Server error (${response.status}), retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(waitMs);
        continue;
      }

      // Client error (4xx, not 429) — don't retry, throw immediately
      const errorText = await response.text();
      throw new Error(
        `EventFinda API request failed (${response.status}): ${errorText}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('EventFinda API request failed')) {
        throw error; // Re-throw non-retryable client errors
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[eventfinda] Network error, retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries}): ${lastError?.message}`);
        await sleep(waitMs);
      }
    }
  }

  throw lastError ?? new Error('EventFinda API request failed after retries');
}

// ============================================
// EventFinda API Types
// ============================================

interface EventFindaSession {
  timezone?: string;
  datetime_start?: string;
  datetime_end?: string;
  is_cancelled?: boolean;
}

interface EventFindaCategory {
  id?: number;
  name?: string;
  url_slug?: string;
}

interface EventFindaLocation {
  id?: number;
  name?: string;
  summary?: string;
}

interface EventFindaImage {
  id?: number;
  transforms?: {
    transforms?: Array<{
      url?: string;
      width?: number;
      height?: number;
    }>;
  };
}

interface EventFindaTicketType {
  name?: string;
  price?: string;
  is_free?: boolean;
}

interface EventFindaEvent {
  id?: number;
  name?: string;
  description?: string;
  url?: string;
  url_slug?: string;
  address?: string;
  location_summary?: string;
  datetime_start?: string;
  datetime_end?: string;
  datetime_summary?: string;
  is_free?: boolean;
  is_featured?: boolean;
  is_cancelled?: boolean;
  restrictions?: string;
  point?: {
    lat?: number;
    lng?: number;
  };
  category?: EventFindaCategory;
  location?: EventFindaLocation;
  images?: {
    images?: EventFindaImage[];
  };
  sessions?: {
    sessions?: EventFindaSession[];
  };
  ticket_types?: {
    ticket_types?: EventFindaTicketType[];
  };
}

interface EventFindaApiResponse {
  '@attributes'?: {
    count?: number;
  };
  events?: EventFindaEvent[];
}

// ============================================
// API Client
// ============================================

async function fetchEventFindaEvents(params: {
  startDate: string;
  endDate?: string;
  categorySlugs?: string[];
  query?: string;
  budgetMax?: number;
  free?: boolean;
  rows?: number;
  offset?: number;
  order?: 'date' | 'popularity';
}): Promise<EventFindaApiResponse> {
  const username = process.env.EVENTFINDA_USERNAME;
  const password = process.env.EVENTFINDA_PASSWORD;

  if (!username || !password) {
    throw new Error('EVENTFINDA_USERNAME and EVENTFINDA_PASSWORD must be set');
  }

  const url = new URL(`${EVENTFINDA_API_BASE}/events.json`);

  // Date range
  url.searchParams.set('start_date', params.startDate);
  if (params.endDate) {
    url.searchParams.set('end_date', params.endDate);
  }

  // Category filter
  if (params.categorySlugs?.length) {
    url.searchParams.set('category_slug', params.categorySlugs.join(','));
  }

  // Free text search
  if (params.query) {
    url.searchParams.set('q', params.query);
  }

  // Price filters
  if (params.free) {
    url.searchParams.set('free', '1');
  }
  if (params.budgetMax !== undefined && params.budgetMax > 0) {
    url.searchParams.set('price_max', String(params.budgetMax));
  }

  // Pagination
  url.searchParams.set('rows', String(params.rows ?? 20));
  if (params.offset) {
    url.searchParams.set('offset', String(params.offset));
  }

  // Ordering — popularity gives more relevant results for discovery
  url.searchParams.set('order', params.order ?? 'popularity');

  // Request useful fields to minimize payload
  url.searchParams.set(
    'fields',
    'event:(id,name,url,url_slug,description,address,location_summary,datetime_start,datetime_end,datetime_summary,is_free,is_cancelled,is_featured,restrictions,point,category,location,images,sessions,ticket_types),category:(id,name,url_slug),location:(id,name),session:(datetime_start,datetime_end,is_cancelled),image:(id,transforms),ticket_type:(name,price,is_free)',
  );

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  console.log(`[eventfinda] Fetching ${url.toString()}`);
  const response = await fetchWithRetry(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });
  return response.json() as Promise<EventFindaApiResponse>;
}

// ============================================
// Event Mapper
// ============================================

function mapEventFindaToEvent(raw: EventFindaEvent): Event | null {
  if (!raw.name || !raw.url) return null;
  if (raw.is_cancelled) return null;

  // Parse dates
  const startDate = raw.datetime_start
    ? new Date(raw.datetime_start).toISOString()
    : new Date().toISOString();
  const endDate = raw.datetime_end
    ? new Date(raw.datetime_end).toISOString()
    : new Date(Date.parse(startDate) + 2 * 60 * 60 * 1000).toISOString();

  // Extract price from ticket_types
  let price: Event['price'] | undefined;
  const ticketTypes = raw.ticket_types?.ticket_types;
  if (ticketTypes?.length && !raw.is_free) {
    const prices = ticketTypes
      .map((tt) => parseFloat(tt.price ?? ''))
      .filter((p) => !isNaN(p) && p > 0);

    if (prices.length > 0) {
      price = {
        min: Math.min(...prices),
        max: Math.max(...prices),
        currency: 'SGD',
      };
    }
  }

  if (raw.is_free) {
    price = { min: 0, max: 0, currency: 'SGD' };
  }

  // Extract image URL (first transform of first image)
  let imageUrl: string | undefined;
  const firstImage = raw.images?.images?.[0];
  if (firstImage?.transforms?.transforms?.length) {
    imageUrl = firstImage.transforms.transforms[0].url;
  }

  // Location
  const lat = raw.point?.lat ?? SINGAPORE_CENTER.lat;
  const lng = raw.point?.lng ?? SINGAPORE_CENTER.lng;
  const locationName = raw.location?.name ?? raw.location_summary ?? 'Singapore';
  const address = raw.address ?? raw.location_summary ?? 'Singapore';

  // Category inference — prefer EventFinda's own category, fall back to keywords
  const efCategorySlug = raw.category?.url_slug;
  const category = inferCategoryFromEventFinda(raw.name, raw.description, efCategorySlug);

  return {
    id: `ef_${raw.id ?? Math.random().toString(36).slice(2)}`,
    name: raw.name,
    description: (raw.description ?? '').slice(0, 500),
    category,
    location: {
      name: locationName,
      address,
      lat,
      lng,
    },
    timeSlot: {
      start: startDate,
      end: endDate,
    },
    price,
    sourceUrl: raw.url,
    source: 'eventfinda',
    imageUrl,
    availability: 'unknown',
    bookingRequired: !raw.is_free,
  };
}

// ============================================
// Demo / Fallback Data
// ============================================

function getDemoEvents(date: string): Event[] {
  const baseDate = date || new Date().toISOString().split('T')[0];
  return [
    {
      id: 'ef_demo_1',
      name: 'Singapore Comedy Night',
      description: 'An evening of stand-up comedy featuring top local and international comedians at the Arts House.',
      category: 'theatre',
      location: { name: 'The Arts House', address: '1 Old Parliament Lane, Singapore 179429', lat: 1.2884, lng: 103.8508 },
      timeSlot: { start: `${baseDate}T19:30:00.000Z`, end: `${baseDate}T22:00:00.000Z` },
      price: { min: 25, max: 40, currency: 'SGD' },
      rating: 4.4,
      sourceUrl: 'https://www.eventfinda.sg/comedy-night',
      source: 'eventfinda',
      availability: 'available',
      bookingRequired: true,
    },
    {
      id: 'ef_demo_2',
      name: 'Artisan Craft Market @ Haji Lane',
      description: 'Browse unique handmade crafts, local art, and artisanal food at this vibrant street market.',
      category: 'exhibition',
      location: { name: 'Haji Lane', address: 'Haji Lane, Singapore 189241', lat: 1.3017, lng: 103.8593 },
      timeSlot: { start: `${baseDate}T10:00:00.000Z`, end: `${baseDate}T18:00:00.000Z` },
      price: { min: 0, max: 0, currency: 'SGD' },
      rating: 4.2,
      sourceUrl: 'https://www.eventfinda.sg/artisan-market',
      source: 'eventfinda',
      availability: 'available',
      bookingRequired: false,
    },
    {
      id: 'ef_demo_3',
      name: 'Sunset Yoga at Marina Barrage',
      description: 'Unwind with a relaxing sunset yoga session overlooking the Marina Bay skyline.',
      category: 'sports',
      location: { name: 'Marina Barrage', address: '8 Marina Gardens Dr, Singapore 018951', lat: 1.2808, lng: 103.8713 },
      timeSlot: { start: `${baseDate}T17:30:00.000Z`, end: `${baseDate}T19:00:00.000Z` },
      price: { min: 15, max: 15, currency: 'SGD' },
      rating: 4.6,
      sourceUrl: 'https://www.eventfinda.sg/sunset-yoga',
      source: 'eventfinda',
      availability: 'available',
      bookingRequired: true,
    },
    {
      id: 'ef_demo_4',
      name: 'Local Beats: Indie Music Showcase',
      description: 'Discover Singapore\'s best indie bands and solo artists at this intimate live music event.',
      category: 'concert',
      location: { name: 'Esplanade Annexe Studio', address: '1 Esplanade Dr, Singapore 038981', lat: 1.2899, lng: 103.8556 },
      timeSlot: { start: `${baseDate}T20:00:00.000Z`, end: `${baseDate}T23:00:00.000Z` },
      price: { min: 20, max: 35, currency: 'SGD' },
      rating: 4.5,
      sourceUrl: 'https://www.eventfinda.sg/indie-music',
      source: 'eventfinda',
      availability: 'limited',
      bookingRequired: true,
    },
    {
      id: 'ef_demo_5',
      name: 'Weekend Pottery Workshop',
      description: 'Hands-on pottery making for beginners. Create your own ceramic bowl or mug to take home.',
      category: 'workshop',
      location: { name: 'Thow Kwang Pottery Jungle', address: '85 Lorong Tawas, Singapore 639823', lat: 1.3312, lng: 103.7195 },
      timeSlot: { start: `${baseDate}T10:00:00.000Z`, end: `${baseDate}T13:00:00.000Z` },
      price: { min: 60, max: 80, currency: 'SGD' },
      rating: 4.7,
      sourceUrl: 'https://www.eventfinda.sg/pottery-workshop',
      source: 'eventfinda',
      availability: 'available',
      bookingRequired: true,
    },
  ];
}

// ============================================
// Tool Definition
// ============================================

export const searchEventfindaTool = createTool({
  id: 'search-eventfinda',
  description:
    'Searches EventFinda Singapore for events using their REST API. Accepts a date range, categories, and budget. Uses HTTP Basic auth with EventFinda API credentials. Returns structured event data with pricing, categories, and location. Falls back to demo data when API credentials are not configured.',
  inputSchema: z.object({
    date: z.string().describe('Start date in YYYY-MM-DD format'),
    dateEnd: z.string().optional().describe('End date in YYYY-MM-DD format (defaults to date + 3 days)'),
    categories: z.array(EventCategorySchema).optional().describe('Event categories to search for'),
    budgetMax: z.number().optional().describe('Maximum budget per person in SGD'),
    areas: z.array(z.string()).optional().describe('Singapore areas to search in'),
    maxResults: z.number().optional().default(20).describe('Maximum number of results to return'),
  }),
  outputSchema: z.object({
    events: z.array(z.any()),
    source: z.string(),
    searchDuration: z.number(),
    mode: z.enum(['live', 'demo']),
    error: z.string().optional(),
  }),
  execute: async (inputData) => {
    const startTime = Date.now();
    const input = inputData;

    const username = process.env.EVENTFINDA_USERNAME;
    const password = process.env.EVENTFINDA_PASSWORD;

    if (!username || !password) {
      console.log('[eventfinda] No credentials — using demo data');
      let events = getDemoEvents(input.date);

      if (input.budgetMax !== undefined) {
        events = events.filter(
          (e) => !e.price || e.price.min <= input.budgetMax!,
        );
      }

      if (input.categories?.length) {
        events = events.filter((e) => input.categories!.includes(e.category));
      }

      return {
        events: events.slice(0, input.maxResults ?? 20),
        source: 'eventfinda',
        searchDuration: Date.now() - startTime,
        mode: 'demo' as const,
      };
    }

    try {
      // Build category slugs from our categories
      const categorySlugs: string[] = [];
      if (input.categories?.length) {
        for (const cat of input.categories) {
          const slug = CATEGORY_TO_EVENTFINDA_SLUG[cat as EventCategory];
          if (slug && !categorySlugs.includes(slug)) {
            categorySlugs.push(slug);
          }
        }
      }

      // Build date range
      const startDate = input.date;
      const endDate = input.dateEnd ?? (() => {
        const d = new Date(input.date);
        d.setDate(d.getDate() + 3);
        return d.toISOString().split('T')[0];
      })();

      console.log(`[eventfinda] Search: ${startDate}→${endDate}, categories: ${categorySlugs.join(', ') || 'all'}, budget: ${input.budgetMax ?? 'unlimited'}`);

      const response = await fetchEventFindaEvents({
        startDate,
        endDate,
        categorySlugs: categorySlugs.length > 0 ? categorySlugs : undefined,
        budgetMax: input.budgetMax,
        free: input.budgetMax === 0 ? true : undefined,
        rows: input.maxResults ?? 20,
        order: 'popularity',
      });

      const totalCount = response['@attributes']?.count ?? 0;
      const rawEvents = response.events ?? [];

      console.log(`[eventfinda] API returned ${rawEvents.length} events (${totalCount} total)`);
      // Map to our Event type
      let events: Event[] = rawEvents
        .map(mapEventFindaToEvent)
        .filter((e): e is Event => e !== null);

      // Post-filter by budget (API price_max may not cover all cases)
      if (input.budgetMax !== undefined) {
        events = events.filter(
          (e) => !e.price || e.price.min <= input.budgetMax!,
        );
      }

      // Post-filter by our categories (EventFinda slugs are coarser)
      if (input.categories?.length) {
        events = events.filter((e) => input.categories!.includes(e.category));
      }

      return {
        events: events.slice(0, input.maxResults ?? 20),
        source: 'eventfinda',
        searchDuration: Date.now() - startTime,
        mode: 'live' as const,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`[eventfinda] Error: ${errorMessage}`);
      // Fallback to demo data on failure
      const events = getDemoEvents(input.date);
      return {
        events: events.slice(0, input.maxResults ?? 20),
        source: 'eventfinda',
        searchDuration: Date.now() - startTime,
        mode: 'demo' as const,
        error: errorMessage,
      };
    }
  },
});
