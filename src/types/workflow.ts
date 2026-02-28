import { z } from 'zod';
import { EventSchema } from './event.js';
import { UserConstraintsSchema } from './constraints.js';
import { ItinerarySchema } from './itinerary.js';
import { BookingActionSchema } from './booking.js';

// ============================================
// Agent Communication Types
// ============================================

export const UserIntentSchema = z.object({
  rawQuery: z.string(),
  intentType: z.enum([
    'plan_date',
    'plan_trip',
    'find_events',
    'book_specific',
    'modify_plan',
  ]),
  extractedConstraints: UserConstraintsSchema,
  clarificationNeeded: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
});

export type UserIntent = z.infer<typeof UserIntentSchema>;

export const AgentMessageSchema = z.object({
  fromAgent: z.string(),
  toAgent: z.string(),
  messageType: z.enum(['request', 'response', 'update', 'error']),
  payload: z.any(),
  timestamp: z.string().datetime({ offset: true }),
  correlationId: z.string(),
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

// ============================================
// Workflow State Types
// ============================================

export const WorkflowStateSchema = z.object({
  workflowId: z.string(),
  currentPhase: z.enum([
    'intent_parsing',
    'event_discovery',
    'recommendation',
    'itinerary_planning',
    'plan_approval',
    'booking_execution',
    'completed',
    'failed',
  ]),
  userIntent: UserIntentSchema.optional(),
  discoveredEvents: z.array(EventSchema).optional(),
  rankedEvents: z.array(EventSchema).optional(),
  itinerary: ItinerarySchema.optional(),
  bookingActions: z.array(BookingActionSchema).optional(),
  errors: z.array(z.string()).optional(),
  startedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;
