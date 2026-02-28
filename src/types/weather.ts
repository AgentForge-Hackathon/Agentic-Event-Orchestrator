import { z } from 'zod';

// ============================================
// Weather Types (for weather-aware planning)
// ============================================

export const WeatherConditionSchema = z.object({
  date: z.string().datetime({ offset: true }),
  condition: z.enum(['sunny', 'cloudy', 'rainy', 'stormy', 'unknown']),
  temperature: z.number(), // celsius
  humidity: z.number(), // percentage
  isOutdoorFriendly: z.boolean(),
});

export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;
