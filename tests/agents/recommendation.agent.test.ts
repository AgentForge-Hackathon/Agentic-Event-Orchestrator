import { describe, it, expect } from 'vitest';
import { recommendationAgent } from '../../src/mastra/agents/recommendation.js';

const RECOMMENDATION_PROMPT = `User occasion: date_night for 2 people, budget $150 SGD, Saturday evening in Singapore.

Top ranked events:
1. "Jazz Night at the Esplanade" — score: 0.85 — budget fit: within budget ($80/person), category: concert, rating: 4.7 — reasoning: "top-rated live music"
2. "Candlelight Dinner at Odette" — score: 0.72 — budget fit: slightly over ($160/person), category: dining, rating: 4.9 — reasoning: "highest-rated dining but over budget"

Filter stats: 12 events removed (8 sold out, 4 over budget). 2 events passed all filters.

Provide your recommendation narrative.`;

describe('recommendationAgent - behavior', () => {
  it('returns valid JSON for ranked events input', async () => {
    const result = await recommendationAgent.generate([
      { role: 'user', content: RECOMMENDATION_PROMPT },
    ]);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      throw new Error(`Agent returned non-JSON response: ${result.text}`);
    }

    expect(parsed).toBeDefined();
  }, 60_000);

  it('returns a non-empty narrative string', async () => {
    const result = await recommendationAgent.generate([
      { role: 'user', content: RECOMMENDATION_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(typeof parsed.narrative).toBe('string');
    expect(parsed.narrative.length).toBeGreaterThan(0);
  }, 60_000);

  it('returns topPickReasoning as a non-empty array', async () => {
    const result = await recommendationAgent.generate([
      { role: 'user', content: RECOMMENDATION_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(Array.isArray(parsed.topPickReasoning)).toBe(true);
    expect(parsed.topPickReasoning.length).toBeGreaterThan(0);
  }, 60_000);

  it('each topPickReasoning entry has eventName and why fields', async () => {
    const result = await recommendationAgent.generate([
      { role: 'user', content: RECOMMENDATION_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    for (const pick of parsed.topPickReasoning as Array<Record<string, unknown>>) {
      expect(typeof pick.eventName).toBe('string');
      expect(typeof pick.why).toBe('string');
    }
  }, 60_000);

  it('returns tradeoffs as an array', async () => {
    const result = await recommendationAgent.generate([
      { role: 'user', content: RECOMMENDATION_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(Array.isArray(parsed.tradeoffs)).toBe(true);
  }, 60_000);

  it('returns confidence as a number between 0 and 1', async () => {
    const result = await recommendationAgent.generate([
      { role: 'user', content: RECOMMENDATION_PROMPT },
    ]);

    const parsed = JSON.parse(result.text);
    expect(typeof parsed.confidence).toBe('number');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0);
    expect(parsed.confidence).toBeLessThanOrEqual(1);
  }, 60_000);
});
