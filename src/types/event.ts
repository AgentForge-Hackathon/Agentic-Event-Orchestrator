import { z } from 'zod';
import { LocationSchema, TimeSlotSchema, PriceRangeSchema } from './location.js';

// ============================================
// Event Types
// ============================================

export const EventCategorySchema = z.enum([
  'concert',
  'theatre',
  'sports',
  'dining',
  'nightlife',
  'outdoor',
  'cultural',
  'workshop',
  'exhibition',
  'festival',
  'other',
]);

export type EventCategory = z.infer<typeof EventCategorySchema>;

export const EventSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: EventCategorySchema,
  location: LocationSchema,
  timeSlot: TimeSlotSchema,
  price: PriceRangeSchema.optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().optional(),
  imageUrl: z.string().url().optional(),
  sourceUrl: z.string().url().nullable(),
  source: z.string(), // e.g., 'eventbrite', 'klook', 'tripadvisor'
  availability: z
    .enum(['available', 'limited', 'sold_out', 'unknown'])
    .default('unknown'),
  bookingRequired: z.boolean().default(false),
});

export type Event = z.infer<typeof EventSchema>;
