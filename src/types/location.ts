import { z } from 'zod';

// ============================================
// Location & Time Types
// ============================================

export const LocationSchema = z.object({
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
});

export type Location = z.infer<typeof LocationSchema>;

export const TimeSlotSchema = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
});

export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const PriceRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  currency: z.string().default('SGD'),
});

export type PriceRange = z.infer<typeof PriceRangeSchema>;
