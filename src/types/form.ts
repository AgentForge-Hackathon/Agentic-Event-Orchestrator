import { z } from 'zod';
import type { PriceRange } from './location.js';
import type { UserConstraints } from './constraints.js';
import type { UserIntent } from './workflow.js';

// ============================================
// Plan Form Types (Frontend wizard → Backend)
// ============================================

export const PlanFormDataSchema = z.object({
  occasion: z.enum([
    'date_night',
    'friends_day_out',
    'family_outing',
    'solo_adventure',
    'celebration',
    'chill_hangout',
  ]),
  additionalNotes: z.string().optional().default(''),
  budgetRange: z.enum(['free', 'under_30', '30_to_80', '80_to_150', '150_plus']),
  partySize: z.number().min(1).max(10),
  date: z.string(), // YYYY-MM-DD
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night', 'flexible']),
  duration: z.enum(['2_3_hours', 'half_day', 'full_day']),
  areas: z.array(z.string()).min(1),
  preferFreeEvents: z.boolean().optional().default(false),
});
export type PlanFormData = z.infer<typeof PlanFormDataSchema>;

/**
 * Maps a PlanFormData wizard submission to the domain UserConstraints + intent type.
 * The Intent Agent uses this structured data + LLM reasoning to produce a rich UserIntent.
 */
export function mapPlanFormToConstraints(form: PlanFormData): {
  intentType: UserIntent['intentType'];
  constraints: Partial<UserConstraints>;
  naturalLanguageSummary: string;
} {
  // Map occasion → intent type
  const occasionToIntent: Record<PlanFormData['occasion'], UserIntent['intentType']> = {
    date_night: 'plan_date',
    friends_day_out: 'plan_trip',
    family_outing: 'plan_trip',
    solo_adventure: 'find_events',
    celebration: 'plan_date',
    chill_hangout: 'find_events',
  };

  // Map budget range → PriceRange
  const budgetMap: Record<PlanFormData['budgetRange'], PriceRange | undefined> = {
    free: { min: 0, max: 0, currency: 'SGD' },
    under_30: { min: 0, max: 30, currency: 'SGD' },
    '30_to_80': { min: 30, max: 80, currency: 'SGD' },
    '80_to_150': { min: 80, max: 150, currency: 'SGD' },
    '150_plus': { min: 150, max: 500, currency: 'SGD' },
  };

  // Map duration → hours
  const durationMap: Record<PlanFormData['duration'], number> = {
    '2_3_hours': 3,
    half_day: 5,
    full_day: 10,
  };

  // Map time of day to approximate start hour for date construction
  const timeOfDayMap: Record<PlanFormData['timeOfDay'], string> = {
    morning: '09:00',
    afternoon: '12:00',
    evening: '18:00',
    night: '20:00',
    flexible: '12:00',
  };

  const startTime = timeOfDayMap[form.timeOfDay];
  const dateStr = `${form.date}T${startTime}:00.000Z`;

  // Build natural language summary for the LLM
  const occasionLabels: Record<PlanFormData['occasion'], string> = {
    date_night: 'a date night',
    friends_day_out: 'a day out with friends',
    family_outing: 'a family outing',
    solo_adventure: 'a solo adventure',
    celebration: 'a celebration',
    chill_hangout: 'a chill hangout',
  };

  const budgetLabels: Record<PlanFormData['budgetRange'], string> = {
    free: 'free activities',
    under_30: 'under $30 per person',
    '30_to_80': '$30-80 per person',
    '80_to_150': '$80-150 per person',
    '150_plus': '$150+ per person',
  };

  const areas = form.areas.includes('anywhere') ? 'anywhere in Singapore' : `in ${form.areas.join(', ')}`;
  const notes = form.additionalNotes ? ` I'm interested in: ${form.additionalNotes}.` : '';
  const freePreference = form.preferFreeEvents ? ' Prioritise free events.' : '';

  const naturalLanguageSummary = `Plan ${occasionLabels[form.occasion]} for ${form.partySize} ${form.partySize === 1 ? 'person' : 'people'}, budget ${budgetLabels[form.budgetRange]}, on ${form.date} (${form.timeOfDay}), lasting ${form.duration.replace(/_/g, ' ')}, ${areas}.${notes}${freePreference}`;

  return {
    intentType: occasionToIntent[form.occasion],
    constraints: {
      budget: budgetMap[form.budgetRange],
      date: dateStr,
      duration: durationMap[form.duration],
      partySize: form.partySize,
    },
    naturalLanguageSummary,
  };
}
