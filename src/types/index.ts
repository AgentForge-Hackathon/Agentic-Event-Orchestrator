// ============================================
// Barrel re-export — all domain types
// ============================================
// This file preserves backward compatibility for all consumers
// importing from 'types/index.js'. Each domain is now in its
// own file for cleaner ownership boundaries.
// ============================================

// Location & Time primitives
export {
  LocationSchema,
  type Location,
  TimeSlotSchema,
  type TimeSlot,
  PriceRangeSchema,
  type PriceRange,
} from './location.js';

// Event types
export {
  EventCategorySchema,
  type EventCategory,
  EventSchema,
  type Event,
} from './event.js';

// User constraints
export {
  UserConstraintsSchema,
  type UserConstraints,
} from './constraints.js';

// Itinerary types
export {
  ItineraryItemSchema,
  type ItineraryItem,
  ItinerarySchema,
  type Itinerary,
} from './itinerary.js';

// Booking types
export {
  BookingActionSchema,
  type BookingAction,
} from './booking.js';

// Agent communication & workflow state
export {
  UserIntentSchema,
  type UserIntent,
  AgentMessageSchema,
  type AgentMessage,
  WorkflowStateSchema,
  type WorkflowState,
} from './workflow.js';

// Weather types
export {
  WeatherConditionSchema,
  type WeatherCondition,
} from './weather.js';

// Plan form types & mapping utility
export {
  PlanFormDataSchema,
  type PlanFormData,
  mapPlanFormToConstraints,
} from './form.js';
