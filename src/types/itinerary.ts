import { z } from 'zod';
import { TimeSlotSchema } from './location.js';
import { EventSchema } from './event.js';

// ============================================
// Itinerary Types
// ============================================

export const ItineraryItemSchema = z.object({
  id: z.string(),
  event: EventSchema,
  scheduledTime: TimeSlotSchema,
  travelTimeFromPrevious: z.number().optional(), // minutes
  travelMode: z.enum(['walk', 'public_transport', 'taxi', 'drive']).optional(),
  status: z
    .enum(['planned', 'booked', 'confirmed', 'cancelled'])
    .default('planned'),
  bookingReference: z.string().optional(),
  notes: z.string().optional(),
});

export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;

export const ItinerarySchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string().datetime({ offset: true }),
  items: z.array(ItineraryItemSchema),
  totalCost: z.number(),
  totalDuration: z.number(), // minutes
  status: z
    .enum(['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'])
    .default('draft'),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type Itinerary = z.infer<typeof ItinerarySchema>;
