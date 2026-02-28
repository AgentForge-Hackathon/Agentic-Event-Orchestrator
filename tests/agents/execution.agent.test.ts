import { describe, it, expect } from 'vitest';
import { executionAgent } from '../../src/mastra/agents/execution.js';

const BOOKING_PROMPT = `Attempt to book tickets for the following event:
Event: "Jazz Night at the Esplanade"
Booking URL: https://www.eventbrite.com/e/jazz-night-at-the-esplanade-tickets-123456
Attendee name: Test User
Attendee email: test@example.com
Party size: 2
Budget: $80 per person

Proceed with the booking flow.`;

describe('executionAgent - behavior', () => {
  it('returns a non-empty response for a booking prompt', async () => {
    const result = await executionAgent.generate([
      { role: 'user', content: BOOKING_PROMPT },
    ]);

    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
  }, 60_000);

  it('does not throw when given a booking instruction', async () => {
    await expect(
      executionAgent.generate([{ role: 'user', content: BOOKING_PROMPT }]),
    ).resolves.toBeDefined();
  }, 60_000);

  it('response describes booking steps or acknowledges tool usage', async () => {
    const result = await executionAgent.generate([
      { role: 'user', content: BOOKING_PROMPT },
    ]);

    const responseText = result.text.toLowerCase();
    const hasBookingContext =
      responseText.includes('book') ||
      responseText.includes('ticket') ||
      responseText.includes('eventbrite') ||
      responseText.includes('browser') ||
      responseText.includes('url') ||
      responseText.includes('open') ||
      responseText.includes('form') ||
      responseText.includes('error') ||
      responseText.includes('unable') ||
      responseText.includes('confirm');

    expect(hasBookingContext).toBe(true);
  }, 60_000);
});
