import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { EventCategorySchema } from '../../types/index.js';
import type { Event, EventCategory } from '../../types/index.js';
import { inferCategory } from './utils/category.js';

// ============================================
// Eventbrite URL Builder
// ============================================

const CATEGORY_TO_EVENTBRITE_KEYWORD: Partial<Record<EventCategory, string>> = {
  concert: 'music',
  theatre: 'performing-visual-arts',
  sports: 'sports-fitness',
  dining: 'food-drink',
  nightlife: 'nightlife',
  outdoor: 'travel-outdoor',
  cultural: 'performing-visual-arts',
  workshop: 'business',
  exhibition: 'performing-visual-arts',
  festival: 'music',
};

function buildEventbriteUrl(_date: string, categories?: EventCategory[]): string {
  const baseUrl = 'https://www.eventbrite.sg/d/singapore--singapore';


  // Eventbrite only supports one category keyword in the URL path
  let keyword = 'events';
  if (categories?.length) {
    for (const cat of categories) {
      const ebKeyword = CATEGORY_TO_EVENTBRITE_KEYWORD[cat];
      if (ebKeyword) {
        keyword = `${ebKeyword}--events`;
        break;
      }
    }
  }

  return `${baseUrl}/${keyword}/`;
}

// ============================================
// Bright Data Fetcher
// ============================================

interface BrightDataConfig {
  apiKey: string;
  zone?: string;
}

async function fetchViaBrightData(
  targetUrl: string,
  config: BrightDataConfig,
): Promise<string> {
  const body: Record<string, string> = {
    url: targetUrl,
    format: 'raw',
  };
  if (config.zone) {
    body.zone = config.zone;
  }

  const response = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Bright Data request failed (${response.status}): ${errorText}`,
    );
  }

  return response.text();
}

// ============================================
// HTML Parsers
// ============================================

interface EventbriteJsonLdOffer {
  price?: string;
  priceCurrency?: string;
  lowPrice?: string;
  highPrice?: string;
  availability?: string;
}

interface EventbriteJsonLdEvent {
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  url?: string;
  image?: string;
  location?: {
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      postalCode?: string;
      addressCountry?: string;
    };
    geo?: {
      latitude?: number;
      longitude?: number;
    };
  };
  offers?: EventbriteJsonLdOffer | EventbriteJsonLdOffer[];
  eventAttendanceMode?: string;
}

/**
 * Extracts event data from Eventbrite list page HTML.
 * Primary: parses `window.__SERVER_DATA__` JSON blob → jsonld[].ItemList.itemListElement
 * Fallback: extracts `<script type="application/ld+json">` blocks for Schema.org Event objects
 *
 * NOTE: List page JSON-LD only contains date (no time) and no pricing.
 * Use `extractEventPageDetails` on individual event pages to get full data.
 */
function extractServerData(html: string): EventbriteJsonLdEvent[] {
  const marker = 'window.__SERVER_DATA__ =';
  const startIdx = html.indexOf(marker);
  if (startIdx !== -1) {
    const jsonStart = html.indexOf('{', startIdx + marker.length);
    if (jsonStart !== -1) {
      const semicolonSearch = '};';
      let searchFrom = jsonStart;
      let jsonStr: string | null = null;
      while (searchFrom < html.length) {
        const semiIdx = html.indexOf(semicolonSearch, searchFrom);
        if (semiIdx === -1) break;
        const candidate = html.slice(jsonStart, semiIdx + 1);
        try {
          JSON.parse(candidate);
          jsonStr = candidate;
          break;
        } catch {
          searchFrom = semiIdx + 1;
        }
      }
      if (jsonStr) {
        try {
          const serverData = JSON.parse(jsonStr);
          const jsonLd = serverData?.jsonld;
          if (Array.isArray(jsonLd)) {
            for (const entry of jsonLd) {
              if (entry?.['@type'] === 'ItemList' && Array.isArray(entry?.itemListElement)) {
                return entry.itemListElement
                  .map((item: { item?: EventbriteJsonLdEvent }) => item?.item)
                  .filter(Boolean) as EventbriteJsonLdEvent[];
              }
            }
          }
        } catch {
          // Failed to parse __SERVER_DATA__ JSON
        }
      }
    }
  }

  const jsonLdScripts = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );

  const events: EventbriteJsonLdEvent[] = [];
  for (const match of jsonLdScripts) {
    try {
      const data = JSON.parse(match[1]);
      if (data?.['@type'] === 'Event' || data?.['@type'] === 'SocialEvent') {
        events.push(data);
      } else if (data?.['@type'] === 'ItemList' && Array.isArray(data?.itemListElement)) {
        for (const item of data.itemListElement) {
          if (item?.item?.['@type'] === 'Event') {
            events.push(item.item);
          }
        }
      }
    } catch {
      // malformed JSON-LD block
    }
  }

  return events;
}

/**
 * Extracts detailed event data (time, price, availability) from an individual event page.
 * Individual event pages have full JSON-LD with:
 * - startDate with time+timezone: "2026-02-27T19:00:00+08:00"
 * - offers with pricing: { lowPrice, highPrice, priceCurrency, availability }
 */
function extractEventPageDetails(html: string, url?: string): EventbriteJsonLdEvent | null {
  const jsonLdScripts = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );

  const allTypes: string[] = [];
  let matchCount = 0;
  for (const match of jsonLdScripts) {
    matchCount++;
    try {
      const data = JSON.parse(match[1]);
      const type = data?.['@type'] ?? 'unknown';
      allTypes.push(type);
      // Schema.org Event subtypes used by Eventbrite:
      // Event, SocialEvent, EducationEvent, BusinessEvent,
      // SocialInteraction, MusicEvent, VisualArtsEvent, etc.
      const eventTypes = new Set([
        'Event', 'SocialEvent', 'EducationEvent', 'BusinessEvent',
        'MusicEvent', 'DanceEvent', 'TheaterEvent', 'VisualArtsEvent',
        'LiteraryEvent', 'Festival', 'FoodEvent', 'SportsEvent',
        'ScreeningEvent', 'ComedyEvent', 'SaleEvent', 'ExhibitionEvent',
        'SocialInteraction', 'Hackathon', 'CourseInstance',
      ]);
      if (eventTypes.has(type) && data?.startDate) {
        return data as EventbriteJsonLdEvent;
      }
    } catch {
      allTypes.push('PARSE_ERROR');
    }
  }

  return null;
}

// ============================================
// Event Detail Enrichment
// ============================================

async function enrichEventsWithDetails(
  events: EventbriteJsonLdEvent[],
  config: BrightDataConfig,
  concurrency = 5,
): Promise<EventbriteJsonLdEvent[]> {
  const uniqueEvents = deduplicateByUrl(events);

  const enriched = [...uniqueEvents];
  const urlsToFetch = uniqueEvents
    .map((e, i) => ({ url: e.url, index: i }))
    .filter((item): item is { url: string; index: number } => !!item.url);

  if (urlsToFetch.length === 0) return enriched;



  console.log(`[eventbrite] Enriching ${urlsToFetch.length} events (concurrency=${concurrency})`);

  for (let i = 0; i < urlsToFetch.length; i += concurrency) {
    const batch = urlsToFetch.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async ({ url, index }) => {
        try {
          const html = await fetchViaBrightData(url, config);
          const details = extractEventPageDetails(html, url);
          if (details) {
            return { index, details };
          }

          return null;
        } catch (err) {

          return null;
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const { index, details } = result.value;
        const original = enriched[index];
        enriched[index] = {
          ...original,
          startDate: details.startDate ?? original.startDate,
          endDate: details.endDate ?? original.endDate,
          offers: details.offers ?? original.offers,
          location: details.location ?? original.location,
          description: details.description ?? original.description,
        };
      }
    }
  }

  const enrichedCount = enriched.filter((e, idx) => {
    const original = uniqueEvents[idx];
    return e.startDate !== original.startDate || e.offers !== original.offers;
  }).length;
  console.log(`[eventbrite] Enriched ${enrichedCount}/${urlsToFetch.length} events`);

  return enriched;
}


// ============================================
// Deduplication
// ============================================

function deduplicateByUrl(events: EventbriteJsonLdEvent[]): EventbriteJsonLdEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (!e.url) return true;
    const normalized = e.url.split('?')[0].replace(/\/+$/, '').toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

// ============================================
// Event Mapper
// ============================================

function generateEventId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `eb_${Math.abs(hash).toString(36)}`;
}

function normalizeOffers(
  offers: EventbriteJsonLdOffer | EventbriteJsonLdOffer[] | undefined,
): EventbriteJsonLdOffer | undefined {
  if (!offers) return undefined;
  if (Array.isArray(offers)) {
    return offers[0];
  }
  return offers;
}

function mapToEvent(raw: EventbriteJsonLdEvent): Event | null {
  if (!raw.name || !raw.url) return null;

  const location = raw.location;
  const address = location?.address;
  const geo = location?.geo;

  const startDate = raw.startDate ?? new Date().toISOString();
  const endDate = raw.endDate ?? new Date(Date.parse(startDate) + 2 * 60 * 60 * 1000).toISOString();

  const offer = normalizeOffers(raw.offers);
  let price: Event['price'] | undefined;
  if (offer) {
    const lowPrice = parseFloat(offer.lowPrice ?? offer.price ?? '');
    const highPrice = parseFloat(offer.highPrice ?? offer.price ?? '');
    const hasLow = !isNaN(lowPrice);
    const hasHigh = !isNaN(highPrice);
    if (hasLow || hasHigh) {
      price = {
        min: hasLow ? lowPrice : 0,
        max: hasHigh ? highPrice : lowPrice,
        currency: offer.priceCurrency ?? 'SGD',
      };
    }
  }

  // Schema.org availability values: InStock, LimitedAvailability, SoldOut, PreOrder, etc.
  let availability: Event['availability'] = 'unknown';
  if (offer?.availability) {
    const avail = offer.availability.toLowerCase();
    if (avail.includes('instock') || avail.includes('available')) {
      availability = 'available';
    } else if (avail.includes('limited')) {
      availability = 'limited';
    } else if (avail.includes('soldout') || avail.includes('sold_out')) {
      availability = 'sold_out';
    }
  }

  return {
    id: generateEventId(raw.url),
    name: raw.name,
    description: (raw.description ?? '').slice(0, 500),
    category: inferCategory(raw.name, raw.description),
    location: {
      name: location?.name ?? 'Singapore',
      address: address
        ? [address.streetAddress, address.addressLocality, address.postalCode]
            .filter(Boolean)
            .join(', ')
        : 'Singapore',
      lat: geo?.latitude ?? 1.3521,
      lng: geo?.longitude ?? 103.8198,
    },
    timeSlot: {
      start: startDate,
      end: endDate,
    },
    price,
    sourceUrl: raw.url,
    source: 'eventbrite',
    imageUrl: raw.image ?? undefined,
    availability,
    bookingRequired: true,
  };
}

// ============================================
// Demo / Fallback Data
// ============================================

function getDemoEvents(date: string): Event[] {
  const baseDate = date || new Date().toISOString().split('T')[0];
  return [
    {
      id: 'eb_demo_1',
      name: 'Jazz Night at Esplanade',
      description: 'An evening of smooth jazz performances featuring local and international artists at the iconic Esplanade.',
      category: 'concert',
      location: { name: 'Esplanade – Theatres on the Bay', address: '1 Esplanade Dr, Singapore 038981', lat: 1.2899, lng: 103.8556 },
      timeSlot: { start: `${baseDate}T19:00:00.000Z`, end: `${baseDate}T22:00:00.000Z` },
      price: { min: 25, max: 65, currency: 'SGD' },
      rating: 4.5,
      sourceUrl: 'https://www.eventbrite.sg/e/jazz-night-esplanade',
      source: 'eventbrite',
      availability: 'available',
      bookingRequired: true,
    },
    {
      id: 'eb_demo_2',
      name: 'Singapore Food Festival Street Market',
      description: 'Sample the best of Singapore street food at this outdoor festival featuring over 50 hawker stalls.',
      category: 'dining',
      location: { name: 'Clarke Quay', address: '3 River Valley Rd, Singapore 179024', lat: 1.2883, lng: 103.8467 },
      timeSlot: { start: `${baseDate}T11:00:00.000Z`, end: `${baseDate}T21:00:00.000Z` },
      price: { min: 0, max: 30, currency: 'SGD' },
      rating: 4.3,
      sourceUrl: 'https://www.eventbrite.sg/e/sg-food-festival',
      source: 'eventbrite',
      availability: 'available',
      bookingRequired: false,
    },
    {
      id: 'eb_demo_3',
      name: 'Night Photography Workshop',
      description: 'Learn night photography techniques in Marina Bay. Covers long exposure, light trails, and cityscape composition.',
      category: 'workshop',
      location: { name: 'Marina Bay Sands', address: '10 Bayfront Ave, Singapore 018956', lat: 1.2834, lng: 103.8607 },
      timeSlot: { start: `${baseDate}T18:30:00.000Z`, end: `${baseDate}T21:30:00.000Z` },
      price: { min: 45, max: 45, currency: 'SGD' },
      rating: 4.7,
      sourceUrl: 'https://www.eventbrite.sg/e/night-photography-workshop',
      source: 'eventbrite',
      availability: 'limited',
      bookingRequired: true,
    },
    {
      id: 'eb_demo_4',
      name: 'Gardens by the Bay Light Show',
      description: 'Experience the spectacular Garden Rhapsody light and sound show at the Supertree Grove.',
      category: 'outdoor',
      location: { name: 'Gardens by the Bay', address: '18 Marina Gardens Dr, Singapore 018953', lat: 1.2816, lng: 103.8636 },
      timeSlot: { start: `${baseDate}T19:45:00.000Z`, end: `${baseDate}T20:15:00.000Z` },
      price: { min: 0, max: 0, currency: 'SGD' },
      rating: 4.6,
      sourceUrl: 'https://www.eventbrite.sg/e/gardens-light-show',
      source: 'eventbrite',
      availability: 'available',
      bookingRequired: false,
    },
    {
      id: 'eb_demo_5',
      name: 'Rooftop Cocktail & DJ Session',
      description: 'Sunset drinks with panoramic views and live DJ spinning house and chill beats.',
      category: 'nightlife',
      location: { name: 'CÉ LA VI', address: '1 Bayfront Ave, Level 57, Singapore 018971', lat: 1.2838, lng: 103.8610 },
      timeSlot: { start: `${baseDate}T17:00:00.000Z`, end: `${baseDate}T23:00:00.000Z` },
      price: { min: 30, max: 80, currency: 'SGD' },
      rating: 4.4,
      sourceUrl: 'https://www.eventbrite.sg/e/rooftop-cocktail-dj',
      source: 'eventbrite',
      availability: 'available',
      bookingRequired: true,
    },
  ];
}

// ============================================
// Tool Definition
// ============================================

export const searchEventbriteTool = createTool({
  id: 'search-eventbrite',
  description:
    'Searches Eventbrite Singapore for events within a date range. Accepts a start date and optional end date (defaults to +3 days). Fetches individual event pages to extract accurate start/end times and ticket prices. Returns structured event data with pricing, ratings, and availability. Falls back to demo data when Bright Data API key is not configured.',
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

    const apiKey = process.env.BRIGHT_DATA_API_KEY;
    const zone = process.env.BRIGHT_DATA_ZONE;

    if (!apiKey) {
      console.log('[eventbrite] No API key — using demo data');
      let events = getDemoEvents(input.date);

      // Drop sold-out events
      events = events.filter((e) => e.availability !== 'sold_out');

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
        source: 'eventbrite',
        searchDuration: Date.now() - startTime,
        mode: 'demo' as const,
      };
    }

    try {
      const config: BrightDataConfig = { apiKey, zone };

      const targetUrl = buildEventbriteUrl(input.date, input.categories);


      console.log(`[eventbrite] Fetching ${targetUrl}`);
      const html = await fetchViaBrightData(targetUrl, config);

      const rawEvents = extractServerData(html);


      const rangeStart = input.date;
      const rangeEnd = input.dateEnd ?? (() => {
        const d = new Date(input.date);
        d.setDate(d.getDate() + 3);
        return d.toISOString().split('T')[0];
      })();

      const inRangeRaw = rawEvents.filter((e) => {
        if (!e.startDate) return true;
        const eventDate = e.startDate.split('T')[0];
        return eventDate >= rangeStart && eventDate <= rangeEnd;
      });


      console.log(`[eventbrite] Parsed ${rawEvents.length} raw → ${inRangeRaw.length} in date range ${rangeStart}→${rangeEnd}`);
      const toEnrich = inRangeRaw.slice(0, input.maxResults ?? 20);
      const enrichedRaw = await enrichEventsWithDetails(toEnrich, config, 5);

      let events: Event[] = enrichedRaw
        .map(mapToEvent)
        .filter((e): e is Event => e !== null);

      // Drop sold-out events — not actionable for the user
      events = events.filter((e) => e.availability !== 'sold_out');

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
        source: 'eventbrite',
        searchDuration: Date.now() - startTime,
        mode: 'live' as const,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);


      console.error(`[eventbrite] Error: ${errorMessage}`);
      const events = getDemoEvents(input.date);
      return {
        events: events.slice(0, input.maxResults ?? 20),
        source: 'eventbrite',
        searchDuration: Date.now() - startTime,
        mode: 'demo' as const,
        error: errorMessage,
      };
    }
  },
});
