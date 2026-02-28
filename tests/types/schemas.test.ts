import { describe, it, expect } from 'vitest';
import { PlanFormDataSchema, mapPlanFormToConstraints } from '@/types/form.js';
import { LocationSchema } from '@/types/location.js';

const validForm = {
  occasion: 'date_night' as const,
  budgetRange: '30_to_80' as const,
  partySize: 2,
  date: '2026-03-15',
  timeOfDay: 'evening' as const,
  duration: '2_3_hours' as const,
  areas: ['Marina Bay'],
};

describe('PlanFormDataSchema', () => {
  it('accepts valid form data', () => {
    expect(PlanFormDataSchema.safeParse(validForm).success).toBe(true);
  });

  it('defaults additionalNotes to empty string', () => {
    const result = PlanFormDataSchema.safeParse(validForm);
    expect(result.success && result.data.additionalNotes).toBe('');
  });

  it('rejects partySize below 1', () => {
    expect(PlanFormDataSchema.safeParse({ ...validForm, partySize: 0 }).success).toBe(false);
  });

  it('rejects partySize above 10', () => {
    expect(PlanFormDataSchema.safeParse({ ...validForm, partySize: 11 }).success).toBe(false);
  });

  it('rejects empty areas array', () => {
    expect(PlanFormDataSchema.safeParse({ ...validForm, areas: [] }).success).toBe(false);
  });

  it('rejects invalid occasion enum value', () => {
    expect(PlanFormDataSchema.safeParse({ ...validForm, occasion: 'weekend_vibes' }).success).toBe(false);
  });
});

describe('mapPlanFormToConstraints', () => {
  const form = PlanFormDataSchema.parse(validForm);

  it('maps date_night → plan_date intent', () => {
    expect(mapPlanFormToConstraints(form).intentType).toBe('plan_date');
  });

  it('maps friends_day_out → plan_trip intent', () => {
    const f = PlanFormDataSchema.parse({ ...validForm, occasion: 'friends_day_out' });
    expect(mapPlanFormToConstraints(f).intentType).toBe('plan_trip');
  });

  it('maps under_30 budget range to correct price range', () => {
    const f = PlanFormDataSchema.parse({ ...validForm, budgetRange: 'under_30' });
    expect(mapPlanFormToConstraints(f).constraints.budget).toEqual({ min: 0, max: 30, currency: 'SGD' });
  });

  it('maps 2_3_hours duration to 3 hours', () => {
    expect(mapPlanFormToConstraints(form).constraints.duration).toBe(3);
  });

  it('includes party size in natural language summary', () => {
    expect(mapPlanFormToConstraints(form).naturalLanguageSummary).toContain('2 people');
  });

  it('includes occasion type in natural language summary', () => {
    expect(mapPlanFormToConstraints(form).naturalLanguageSummary).toContain('date night');
  });
});

describe('LocationSchema', () => {
  it('accepts valid location', () => {
    const result = LocationSchema.safeParse({
      name: 'Marina Bay Sands',
      address: '10 Bayfront Ave, Singapore',
      lat: 1.2834,
      lng: 103.8607,
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional placeId', () => {
    const result = LocationSchema.safeParse({
      name: 'Test',
      address: 'Test',
      lat: 1.0,
      lng: 103.0,
      placeId: 'ChIJ...',
    });
    expect(result.success).toBe(true);
  });

  it('rejects location missing required lat/lng', () => {
    expect(LocationSchema.safeParse({ name: 'Missing', address: 'Addr' }).success).toBe(false);
  });
});

describe('@shared path alias', () => {
  it('resolves @shared/types/trace module at runtime', async () => {
    const mod = await import('@shared/types/trace.js');
    expect(mod).toBeDefined();
  });
});
