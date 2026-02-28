import { describe, it, expect } from 'vitest';
import { planningAgent } from '../../src/mastra/agents/planning.js';

const VALID_BUDGET_STATUSES = ['within_budget', 'slightly_over', 'over_budget'] as const;
const VALID_CATEGORIES = [
  'dining', 'nightlife', 'outdoor', 'cultural', 'concert',
  'theatre', 'sports', 'workshop', 'exhibition', 'festival', 'other',
] as const;

const PLANNING_PROMPT = `Main event (SACRED — copy times exactly):
Name: "Jazz Night at the Esplanade"
Category: concert
Location: Esplanade – Theatres on the Bay, 1 Esplanade Dr, Singapore 038981
Time slot: 20:00 - 22:00 SGT
Price: $80 per person
Score: 0.85

User constraints:
- Occasion: date_night
- Budget: $150 SGD per person
- Party size: 2
- Date: this Saturday
- Time window: evening (18:00 - 23:00 SGT)
- Preferred areas: Marina Bay, Clarke Quay

Recommendation narrative: "Jazz Night at the Esplanade is a perfect romantic evening anchor with top-rated live music well within budget."

Generate the itinerary plan.`;

describe('planningAgent - behavior', () => {
  it('returns valid JSON for a planning prompt', async () => {
    const result = await planningAgent.generate([
      { role: 'user', content: PLANNING_PROMPT },
    ]);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      throw new Error(`Agent returned non-JSON response: ${result.text}`);
    }

    expect(parsed).toBeDefined();
  }, 60_000);

  it('returns a non-empty itineraryName', async () => {
    const result = await planningAgent.generate([
      { role: 'user', content: PLANNING_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(typeof parsed.itineraryName).toBe('string');
    expect(parsed.itineraryName.length).toBeGreaterThan(0);
  }, 60_000);

  it('returns items array with 3 to 4 entries', async () => {
    const result = await planningAgent.generate([
      { role: 'user', content: PLANNING_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(Array.isArray(parsed.items)).toBe(true);
    expect(parsed.items.length).toBeGreaterThanOrEqual(3);
    expect(parsed.items.length).toBeLessThanOrEqual(4);
  }, 60_000);

  it('has exactly one main event item', async () => {
    const result = await planningAgent.generate([
      { role: 'user', content: PLANNING_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    const mainEvents = parsed.items.filter(
      (item: Record<string, unknown>) => item.isMainEvent === true,
    );
    expect(mainEvents).toHaveLength(1);
  }, 60_000);

  it('preserves the exact main event name', async () => {
    const result = await planningAgent.generate([
      { role: 'user', content: PLANNING_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    const mainEvent = parsed.items.find(
      (item: Record<string, unknown>) => item.isMainEvent === true,
    ) as Record<string, unknown>;

    expect(mainEvent.name).toBe('Jazz Night at the Esplanade');
  }, 60_000);

  it('preserves the exact main event start and end times', async () => {
    const result = await planningAgent.generate([
      { role: 'user', content: PLANNING_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    const mainEvent = parsed.items.find(
      (item: Record<string, unknown>) => item.isMainEvent === true,
    ) as Record<string, unknown>;

    expect(mainEvent.startTime).toBe('20:00');
    expect(mainEvent.endTime).toBe('22:00');
  }, 60_000);

  it('all items have required fields', async () => {
    const result = await planningAgent.generate([
      { role: 'user', content: PLANNING_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    for (const item of parsed.items as Array<Record<string, unknown>>) {
      expect(typeof item.name).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(typeof item.startTime).toBe('string');
      expect(typeof item.endTime).toBe('string');
      expect(typeof item.isMainEvent).toBe('boolean');
      expect(item.location).toBeDefined();
    }
  }, 60_000);

  it('all items have a valid category', async () => {
    const result = await planningAgent.generate([
      { role: 'user', content: PLANNING_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    for (const item of parsed.items as Array<Record<string, unknown>>) {
      expect(VALID_CATEGORIES).toContain(item.category);
    }
  }, 60_000);

  it('returns totalEstimatedCostPerPerson as a number', async () => {
    const result = await planningAgent.generate([
      { role: 'user', content: PLANNING_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(typeof parsed.totalEstimatedCostPerPerson).toBe('number');
  }, 60_000);

  it('returns a valid budgetStatus', async () => {
    const result = await planningAgent.generate([
      { role: 'user', content: PLANNING_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(VALID_BUDGET_STATUSES).toContain(parsed.budgetStatus);
  }, 60_000);
});
