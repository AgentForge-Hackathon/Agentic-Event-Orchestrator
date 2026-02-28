import { z } from 'zod';

// ============================================
// Booking Types
// ============================================

export const BookingActionSchema = z.object({
  eventId: z.string(),
  actionType: z.enum(['check_availability', 'reserve', 'book', 'cancel']),
  status: z.enum(['pending', 'in_progress', 'success', 'failed']),
  confirmationNumber: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime({ offset: true }),
});

export type BookingAction = z.infer<typeof BookingActionSchema>;
