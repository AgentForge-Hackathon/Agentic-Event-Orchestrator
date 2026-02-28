import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { EventCategorySchema, type Event, type EventCategory } from '../../types/index.js';

// ============================================
// Scoring Weights (sum to 1.0)
// ============================================

const WEIGHTS = {
  budgetFit: 0.30,
  categoryMatch: 0.25,
  rating: 0.20,
  availability: 0.15,
  weather: 0.10,
} as const;

// ============================================
// Scoring Functions (each returns 0..1)
// ============================================

/**
 * Budget fit: 1.0 if free or within budget, scales down as price exceeds budget.
 * Events with no price info get a neutral 0.5.
 */
function scoreBudgetFit(event: Event, budgetMin?: number, budgetMax?: number): { score: number; detail: string } {
  if (!event.price) {
    return { score: 0.5, detail: 'No price info — neutral score' };
  }

  const eventMin = event.price.min;
  const eventMax = event.price.max;

  // Free event always scores well
  if (eventMax === 0) {
    return { score: 1.0, detail: 'Free event' };
  }

  // No budget constraint — everything fits
  if (budgetMax == null) {
    return { score: 0.7, detail: 'No budget constraint set' };
  }

  // Fully within budget
  if (eventMax <= budgetMax && (budgetMin == null || eventMin >= budgetMin)) {
    const utilization = eventMax / budgetMax;
    // Prefer events that use ~60-80% of budget (sweet spot)
    const sweetSpot = 1.0 - Math.abs(utilization - 0.7) * 0.5;
    return { score: Math.max(0.6, sweetSpot), detail: `$${eventMin}-${eventMax} within $${budgetMax} budget` };
  }

  // Partially over budget — penalize proportionally
  if (eventMin <= budgetMax) {
    const overRatio = (eventMax - budgetMax) / budgetMax;
    const score = Math.max(0.1, 0.6 - overRatio);
    return { score, detail: `$${eventMin}-${eventMax} partially exceeds $${budgetMax} budget` };
  }

  // Completely over budget
  const overRatio = (eventMin - budgetMax) / budgetMax;
  const score = Math.max(0, 0.3 - overRatio);
  return { score, detail: `$${eventMin}-${eventMax} exceeds $${budgetMax} budget` };
}

/**
 * Category match: 1.0 if event matches a preferred category, 0.5 for neutral, 0.0 for excluded.
 */
function scoreCategoryMatch(
  event: Event,
  preferredCategories?: EventCategory[],
  excludedCategories?: EventCategory[],
): { score: number; detail: string } {
  const cat = event.category;

  if (excludedCategories?.includes(cat)) {
    return { score: 0, detail: `Category "${cat}" is excluded` };
  }

  if (!preferredCategories || preferredCategories.length === 0) {
    return { score: 0.5, detail: 'No category preference — neutral score' };
  }

  if (preferredCategories.includes(cat)) {
    return { score: 1.0, detail: `Category "${cat}" matches preference` };
  }

  // Not preferred but not excluded — mild penalty
  return { score: 0.3, detail: `Category "${cat}" not in preferred list` };
}

/**
 * Rating score: normalized from 0-5 star rating.
 * Events with no rating get 0.4 (slightly below average).
 */
function scoreRating(event: Event): { score: number; detail: string } {
  if (event.rating == null) {
    return { score: 0.4, detail: 'No rating — below-average default' };
  }

  const normalized = event.rating / 5;
  const reviewBoost = event.reviewCount && event.reviewCount > 50 ? 0.05 : 0;
  const score = Math.min(1.0, normalized + reviewBoost);
  const reviewStr = event.reviewCount ? ` (${event.reviewCount} reviews)` : '';
  return { score, detail: `${event.rating}/5 stars${reviewStr}` };
}

/**
 * Availability score: rewards bookable/available events, penalizes sold-out.
 */
function scoreAvailability(event: Event): { score: number; detail: string } {
  switch (event.availability) {
    case 'available':
      return { score: 1.0, detail: 'Available' };
    case 'limited':
      return { score: 0.8, detail: 'Limited availability' };
    case 'unknown':
      return { score: 0.5, detail: 'Availability unknown' };
    case 'sold_out':
      return { score: 0, detail: 'Sold out' };
    default:
      return { score: 0.5, detail: 'Availability unknown' };
  }
}

/**
 * Weather suitability: penalizes outdoor events when weather is bad.
 */
function scoreWeather(event: Event, isOutdoorFriendly?: boolean): { score: number; detail: string } {
  if (isOutdoorFriendly == null) {
    return { score: 0.5, detail: 'Weather data unavailable — neutral' };
  }

  const isOutdoor = event.category === 'outdoor';

  if (isOutdoor && !isOutdoorFriendly) {
    return { score: 0.1, detail: 'Outdoor event but weather is poor' };
  }

  if (isOutdoor && isOutdoorFriendly) {
    return { score: 1.0, detail: 'Outdoor event with good weather' };
  }

  // Indoor events are weather-neutral
  return { score: 0.6, detail: isOutdoorFriendly ? 'Indoor event, good weather outside' : 'Indoor event, bad weather outside — good choice' };
}

// ============================================
// Main Tool
// ============================================

/**
 * Rank Events Tool
 *
 * Phase 1: Hard-constraint filtering (excluded categories, sold out, completely over budget).
 * Phase 2: Multi-factor scoring (budget fit, category match, rating, availability, weather).
 * Returns sorted events (highest score first) with per-event reasoning.
 */
export const rankEventsTool = createTool({
  id: 'rank-events',
  description:
    'Filters and ranks events by hard constraints (budget, excluded categories) then scores by rating, budget fit, category match, weather, and availability. Returns sorted events with reasoning.',
  inputSchema: z.object({
    events: z.array(z.record(z.any())).describe('Events to rank — accepts any event shape to avoid strict validation failures from scraped data'),
    budgetMin: z.number().optional().describe('Minimum budget in SGD'),
    budgetMax: z.number().optional().describe('Maximum budget in SGD'),
    preferredCategories: z.array(EventCategorySchema).optional().describe('Preferred event categories'),
    excludedCategories: z.array(EventCategorySchema).optional().describe('Categories to exclude'),
    isOutdoorFriendly: z.boolean().optional().describe('Whether weather is suitable for outdoor activities'),
    preferFreeEvents: z.boolean().optional().describe('When true, significantly boost free events in ranking'),
  }),
  execute: async ({ events: rawEvents, budgetMin, budgetMax, preferredCategories, excludedCategories, isOutdoorFriendly, preferFreeEvents }) => {
    // Cast from relaxed schema — events are already Event-shaped from discovery tools
    const events = rawEvents as unknown as Event[];
    const totalInput = events.length;
    console.log(`[rank] Ranking ${totalInput} events`);

    // ── Phase 1: Hard-constraint filtering ──
    const filtered = events.filter((event) => {
      // Exclude sold-out events
      if (event.availability === 'sold_out') {
        console.log(`[rank]   Filtered out (sold out): ${event.name}`);
        return false;
      }

      // Exclude by category
      if (excludedCategories?.includes(event.category)) {
        console.log(`[rank]   Filtered out (excluded category "${event.category}"): ${event.name}`);
        return false;
      }

      // Exclude events completely over budget (if price is known and budget is set)
      if (budgetMax != null && event.price && event.price.min > budgetMax * 1.5) {
        console.log(`[rank]   Filtered out (way over budget $${event.price.min} > $${budgetMax * 1.5}): ${event.name}`);
        return false;
      }

      return true;
    });

    console.log(`[rank]   Passed hard filters: ${filtered.length}/${totalInput}`);

    // ── Phase 2: Multi-factor scoring ──
    const scored = filtered.map((event) => {
      const budget = scoreBudgetFit(event, budgetMin, budgetMax);
      const category = scoreCategoryMatch(event, preferredCategories, excludedCategories);
      const rating = scoreRating(event);
      const availability = scoreAvailability(event);
      const weather = scoreWeather(event, isOutdoorFriendly);

      const totalScore =
        budget.score * WEIGHTS.budgetFit +
        category.score * WEIGHTS.categoryMatch +
        rating.score * WEIGHTS.rating +
        availability.score * WEIGHTS.availability +
        weather.score * WEIGHTS.weather;

      // Apply free-event boost: if user prefers free events and this event is free, add a significant bonus
      const isFreeEvent = event.price && event.price.max === 0;
      const freeBoost = preferFreeEvents && isFreeEvent ? 0.25 : 0;
      const boostedScore = Math.min(1.0, totalScore + freeBoost);

      // Round to 2 decimal places
      const score = Math.round(boostedScore * 100) / 100;

      // Build human-readable reasoning
      const parts = [
        `Budget: ${budget.detail} (${(budget.score * 100).toFixed(0)}%)`,
        `Category: ${category.detail} (${(category.score * 100).toFixed(0)}%)`,
        `Rating: ${rating.detail} (${(rating.score * 100).toFixed(0)}%)`,
        `Availability: ${availability.detail} (${(availability.score * 100).toFixed(0)}%)`,
        `Weather: ${weather.detail} (${(weather.score * 100).toFixed(0)}%)`,
        ...(freeBoost > 0 ? [`Free event boost: +${(freeBoost * 100).toFixed(0)}%`] : []),
      ];
      const reasoning = `Score ${score}/1.00 — ${parts.join('; ')}`;

      return { event, score, reasoning };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // Log top results
    const top = scored.slice(0, 5);
    top.forEach((r, i) => {
      console.log(`[rank]   ${i + 1}. ${r.event.name} — score ${r.score}`);
    });

    console.log(`[rank] Ranking complete: ${scored.length} events scored`);

    return {
      rankedEvents: scored,
      filterStats: {
        totalInput,
        passedFilters: filtered.length,
        finalCount: scored.length,
      },
    };
  },
});
