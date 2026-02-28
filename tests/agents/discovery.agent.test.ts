import { describe, it, expect } from 'vitest';
import { discoveryAgent } from '../../src/mastra/agents/discovery.js';

const DISCOVERY_PROMPT = `Search for events in Singapore for this Saturday evening, 2 people, budget $100 per person.
Preferably dining or cultural events in the Marina Bay or Chinatown area.`;

describe('discoveryAgent - behavior', () => {
  it('returns a non-empty response for a Singapore event search', async () => {
    const result = await discoveryAgent.generate([
      { role: 'user', content: DISCOVERY_PROMPT },
    ]);

    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
  }, 60_000);

  it('response references Singapore events or a search attempt', async () => {
    const result = await discoveryAgent.generate([
      { role: 'user', content: DISCOVERY_PROMPT },
    ]);

    const responseText = result.text.toLowerCase();
    const hasRelevantContent =
      responseText.includes('singapore') ||
      responseText.includes('event') ||
      responseText.includes('search') ||
      responseText.includes('found') ||
      responseText.includes('result') ||
      responseText.includes('marina') ||
      responseText.includes('chinatown');

    expect(hasRelevantContent).toBe(true);
  }, 60_000);

  it('does not throw when discovering events', async () => {
    await expect(
      discoveryAgent.generate([{ role: 'user', content: DISCOVERY_PROMPT }]),
    ).resolves.toBeDefined();
  }, 60_000);
});
