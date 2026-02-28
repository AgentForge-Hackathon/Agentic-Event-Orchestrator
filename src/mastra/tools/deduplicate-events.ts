import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { EventSchema, type Event } from '../../types/index.js';

// ============================================
// Normalization helpers
// ============================================

/** Normalize a string for fuzzy comparison: lowercase, strip punctuation, collapse whitespace. */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple similarity ratio between two strings (0..1).
 * Uses longest-common-subsequence length / max length.
 * Fast enough for <100 events — no need for Levenshtein.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const lenA = a.length;
  const lenB = b.length;

  // LCS via two-row DP (O(n*m) time, O(min(n,m)) space)
  const prev = new Array(lenB + 1).fill(0);
  const curr = new Array(lenB + 1).fill(0);

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    // Copy curr to prev
    for (let j = 0; j <= lenB; j++) {
      prev[j] = curr[j];
      curr[j] = 0;
    }
  }

  const lcsLen = prev[lenB];
  return lcsLen / Math.max(lenA, lenB);
}

/** Check if two events overlap in time (same day + overlapping time windows). */
function hasTimeOverlap(a: Event, b: Event): boolean {
  const aStart = new Date(a.timeSlot.start).getTime();
  const aEnd = new Date(a.timeSlot.end).getTime();
  const bStart = new Date(b.timeSlot.start).getTime();
  const bEnd = new Date(b.timeSlot.end).getTime();

  // Events overlap if they share any time range
  return aStart < bEnd && bStart < aEnd;
}

// ============================================
// Dedup thresholds
// ============================================

/** Name similarity threshold to consider two events as potential duplicates. */
const NAME_SIMILARITY_THRESHOLD = 0.75;

/** URL-based exact match (same source URL = definitely duplicate). */
function hasSameUrl(a: Event, b: Event): boolean {
  if (!a.sourceUrl || !b.sourceUrl) return false;
  // Normalize URLs by stripping trailing slashes and query params for comparison
  const normalizeUrl = (url: string) => url.split('?')[0].replace(/\/+$/, '').toLowerCase();
  return normalizeUrl(a.sourceUrl) === normalizeUrl(b.sourceUrl);
}

// ============================================
// Main Tool
// ============================================

/**
 * Deduplicate Events Tool
 *
 * Merges events from multiple sources, removing duplicates.
 * Strategy:
 *   1. Exact URL match → definite duplicate
 *   2. Similar normalized name (>75%) + overlapping time → likely duplicate
 *   3. When duplicates found, keep the event with more data (price, rating, etc.)
 */
export const deduplicateEventsTool = createTool({
  id: 'deduplicate-events',
  description:
    'Deduplicates events from multiple sources by matching on name, URL, and time overlap. Returns a merged list with duplicates removed.',
  inputSchema: z.object({
    events: z.array(EventSchema).describe('Array of events from multiple sources to deduplicate'),
  }),
  outputSchema: z.object({
    events: z.array(EventSchema),
    originalCount: z.number(),
    deduplicatedCount: z.number(),
    removedCount: z.number(),
  }),
  execute: async ({ events }) => {
    const originalCount = events.length;

    if (originalCount <= 1) {
      return {
        events,
        originalCount,
        deduplicatedCount: originalCount,
        removedCount: 0,
      };
    }

    console.log(`[dedup] Deduplicating ${originalCount} events`);

    // Track which indices have been merged into another event
    const merged = new Set<number>();
    // Result array — we'll pick the "best" version of each duplicate group
    const result: Event[] = [];

    for (let i = 0; i < events.length; i++) {
      if (merged.has(i)) continue;

      let best = events[i];

      for (let j = i + 1; j < events.length; j++) {
        if (merged.has(j)) continue;

        const candidate = events[j];
        let isDuplicate = false;

        // Check 1: Exact URL match
        if (hasSameUrl(best, candidate)) {
          isDuplicate = true;
        }

        // Check 2: Similar name + time overlap
        if (!isDuplicate) {
          const nameSim = similarity(normalize(best.name), normalize(candidate.name));
          if (nameSim >= NAME_SIMILARITY_THRESHOLD && hasTimeOverlap(best, candidate)) {
            isDuplicate = true;
          }
        }

        if (isDuplicate) {
          console.log(`[dedup]   Duplicate found: "${candidate.name}" (${candidate.source}) ≈ "${best.name}" (${best.source})`);
          merged.add(j);

          // Keep the version with more data (prefer: has price, has rating, has image)
          const scoreEvent = (e: Event): number => {
            let s = 0;
            if (e.price) s += 2;
            if (e.rating != null) s += 2;
            if (e.imageUrl) s += 1;
            if (e.reviewCount && e.reviewCount > 0) s += 1;
            if (e.description.length > 50) s += 1;
            return s;
          };

          if (scoreEvent(candidate) > scoreEvent(best)) {
            best = candidate;
          }
        }
      }

      result.push(best);
    }

    const removedCount = originalCount - result.length;
    console.log(`[dedup] Deduplication complete: ${originalCount} → ${result.length} (${removedCount} duplicates removed)`);

    return {
      events: result,
      originalCount,
      deduplicatedCount: result.length,
      removedCount,
    };
  },
});
