import { describe, it, expect } from 'vitest';
import { intentAgent } from '../../src/mastra/agents/intent.js';

const VALID_INTENT_TYPES = ['plan_date', 'plan_trip', 'find_events', 'book_specific', 'modify_plan'] as const;

const DATE_NIGHT_PROMPT = `I want to plan a romantic date night in Singapore for 2 people this Saturday evening.
Budget is about $150 SGD per person. We enjoy dining and cultural experiences.`;

describe('intentAgent - behavior', () => {
  it('returns valid JSON for a date night prompt', async () => {
    const result = await intentAgent.generate([
      { role: 'user', content: DATE_NIGHT_PROMPT },
    ]);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      throw new Error(`Agent returned non-JSON response: ${result.text}`);
    }

    expect(parsed).toBeDefined();
  }, 60_000);

  it('infers plan_date intent from a date night prompt', async () => {
    const result = await intentAgent.generate([
      { role: 'user', content: DATE_NIGHT_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(parsed.intentType).toBe('plan_date');
  }, 60_000);

  it('returns intentType from the allowed enum', async () => {
    const result = await intentAgent.generate([
      { role: 'user', content: DATE_NIGHT_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(VALID_INTENT_TYPES).toContain(parsed.intentType);
  }, 60_000);

  it('returns preferredCategories as a non-empty array', async () => {
    const result = await intentAgent.generate([
      { role: 'user', content: DATE_NIGHT_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(Array.isArray(parsed.preferredCategories)).toBe(true);
    expect(parsed.preferredCategories.length).toBeGreaterThan(0);
  }, 60_000);

  it('includes dining or cultural in preferredCategories for a date night', async () => {
    const result = await intentAgent.generate([
      { role: 'user', content: DATE_NIGHT_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    const dateNightCategories = ['dining', 'nightlife', 'cultural', 'concert', 'theatre', 'exhibition'];
    const hasDateNightCategory = parsed.preferredCategories.some(
      (cat: string) => dateNightCategories.includes(cat),
    );
    expect(hasDateNightCategory).toBe(true);
  }, 60_000);

  it('returns excludedCategories as an array', async () => {
    const result = await intentAgent.generate([
      { role: 'user', content: DATE_NIGHT_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(Array.isArray(parsed.excludedCategories)).toBe(true);
  }, 60_000);

  it('returns confidence as a number between 0 and 1', async () => {
    const result = await intentAgent.generate([
      { role: 'user', content: DATE_NIGHT_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(typeof parsed.confidence).toBe('number');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0);
    expect(parsed.confidence).toBeLessThanOrEqual(1);
  }, 60_000);

  it('returns clarificationNeeded as an array', async () => {
    const result = await intentAgent.generate([
      { role: 'user', content: DATE_NIGHT_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(Array.isArray(parsed.clarificationNeeded)).toBe(true);
  }, 60_000);

  it('returns a non-empty reasoning string', async () => {
    const result = await intentAgent.generate([
      { role: 'user', content: DATE_NIGHT_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(typeof parsed.reasoning).toBe('string');
    expect(parsed.reasoning.length).toBeGreaterThan(0);
  }, 60_000);
});
