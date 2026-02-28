import { z } from 'zod';
import { PriceRangeSchema, LocationSchema } from './location.js';
import { EventCategorySchema } from './event.js';

// ============================================
// User Constraints
// ============================================

export const UserConstraintsSchema = z.object({
  budget: PriceRangeSchema.optional(),
  date: z.string().datetime({ offset: true }),
  duration: z.number().optional(), // hours
  startLocation: LocationSchema.optional(),
  endLocation: LocationSchema.optional(),
  preferredCategories: z.array(EventCategorySchema).optional(),
  excludedCategories: z.array(EventCategorySchema).optional(),
  maxTravelTime: z.number().optional(), // minutes between activities
  partySize: z.number().default(1),
  accessibility: z.boolean().default(false),
  weatherSensitive: z.boolean().default(true),
});

export type UserConstraints = z.infer<typeof UserConstraintsSchema>;
