/**
 * End-to-end booking test:
 *   1. Scrape events from Eventbrite + EventFinda
 *   2. Filter to FREE, available events with a source URL
 *   3. Pick the first one
 *   4. Run executeBookingTool against it
 *
 * Usage:
 *   npx tsx src/test-booking.ts              # scrape + book first free event
 *   npx tsx src/test-booking.ts --dry-run    # scrape + filter only, no booking
 *   npx tsx src/test-booking.ts --url <url>  # skip scraping, book a specific URL directly
 *   npx tsx src/test-booking.ts --party 2    # book for 2 people (tests quantity stepper)
 */

import 'dotenv/config';
import { searchEventbriteTool } from './mastra/tools/search-eventbrite.js';
import { searchEventfindaTool } from './mastra/tools/search-eventfinda.js';
import { executeBookingTool } from './mastra/tools/execute-booking.js';

// ── Helpers ──

function getDateStr(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });
}

function isFreeEvent(event: any): boolean {
  const price = event.price;
  if (!price) return true; // no price listed — might be free
  return price.min === 0 && price.max === 0;
}

function hasUrl(event: any): boolean {
  return !!event.sourceUrl && event.sourceUrl.startsWith('http');
}

function isAvailable(event: any): boolean {
  return event.availability !== 'sold_out';
}

function printEvent(event: any, index: number): void {
  const start = event.timeSlot?.start ? formatTime(event.timeSlot.start) : 'TBA';
  const end = event.timeSlot?.end ? formatTime(event.timeSlot.end) : 'TBA';
  const price = event.price;
  const priceStr = !price ? 'Price N/A' : price.min === 0 && price.max === 0 ? 'FREE' : `$${price.min}–$${price.max} ${price.currency}`;

  console.log(`  ${index + 1}. ${event.name}`);
  console.log(`     📅 ${start} → ${end}`);
  console.log(`     📍 ${event.location?.name ?? 'TBA'}`);
  console.log(`     💰 ${priceStr}  |  ${event.availability}  |  🏷️  ${event.category}`);
  console.log(`     🔗 ${event.sourceUrl ?? '(no URL)'}`);
  console.log(`     📦 Source: ${event.source}`);
  console.log();
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const urlIndex = args.indexOf('--url');
  const directUrl = urlIndex !== -1 ? args[urlIndex + 1] : null;
  const partyIndex = args.indexOf('--party');
  const partySize = partyIndex !== -1 ? parseInt(args[partyIndex + 1] ?? '1', 10) : 1;

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   🎟️  END-TO-END BOOKING TEST                ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // Check env
  const hasBrightData = !!process.env.BRIGHT_DATA_API_KEY;
  const hasEventFinda = !!process.env.EVENTFINDA_USERNAME && !!process.env.EVENTFINDA_PASSWORD;
  console.log(`  Bright Data API: ${hasBrightData ? '✅ SET' : '❌ NOT SET (demo mode)'}`);
  console.log(`  EventFinda API:  ${hasEventFinda ? '✅ SET' : '❌ NOT SET (demo mode)'}`);
  console.log(`  Mode:            ${dryRun ? '🔍 DRY RUN (no booking)' : directUrl ? `🎯 DIRECT URL: ${directUrl}` : '🚀 FULL (scrape + book)'}`);
  console.log(`  Party size:      ${partySize} ${partySize === 1 ? 'person' : 'people'}`);
  console.log();

  // ── Direct URL mode: skip scraping ──
  if (directUrl) {
    console.log('━━━ STEP 1: Skipping scrape — using direct URL ━━━\n');
    console.log(`  URL: ${directUrl}\n`);

    console.log('━━━ STEP 2: Executing booking ━━━\n');
    const result = await executeBookingTool.execute!({
      eventId: 'direct-test',
      eventName: 'Direct URL Test',
      sourceUrl: directUrl,
      partySize,
      userProfile: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+6591234567',
      },
      eventSource: 'unknown',
      bookingRequired: true,
    }, {} as any);

    console.log('\n━━━ BOOKING RESULT ━━━\n');
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // ── Step 1: Scrape from both sources in parallel ──
  console.log('━━━ STEP 1: Scraping events from Eventbrite + EventFinda ━━━\n');
  const dateStr = getDateStr();
  const weekEnd = new Date(dateStr);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const dateEndStr = weekEnd.toISOString().split('T')[0];
  console.log(`  Date range: ${dateStr} → ${dateEndStr}\n`);

  const [ebResult, efResult] = await Promise.allSettled([
    searchEventbriteTool.execute!({
      date: dateStr,
      dateEnd: dateEndStr,
      maxResults: 20,
    }, {} as any),
    searchEventfindaTool.execute!({
      date: dateStr,
      dateEnd: dateEndStr,
      maxResults: 20,
    }, {} as any),
  ]);

  const ebEvents = ebResult.status === 'fulfilled' ? (ebResult.value as any).events ?? [] : [];
  const efEvents = efResult.status === 'fulfilled' ? (efResult.value as any).events ?? [] : [];

  console.log(`  Eventbrite: ${ebEvents.length} events (${ebResult.status})`);
  console.log(`  EventFinda: ${efEvents.length} events (${efResult.status})`);

  const allEvents = [...ebEvents, ...efEvents];
  console.log(`  Total:      ${allEvents.length} events\n`);

  // ── Step 2: Filter to free, available events with URLs ──
  console.log('━━━ STEP 2: Filtering to FREE + available + has URL ━━━\n');

  const freeEvents = allEvents.filter((e: any) => isFreeEvent(e) && hasUrl(e) && isAvailable(e));

  console.log(`  Free + available + has URL: ${freeEvents.length} events\n`);

  if (freeEvents.length === 0) {
    console.log('  ⚠️  No free events found. Try --url <url> to test booking directly.\n');

    // Show what we did find for debugging
    if (allEvents.length > 0) {
      console.log('  All scraped events (for reference):\n');
      allEvents.slice(0, 5).forEach((e: any, i: number) => printEvent(e, i));
    }
    return;
  }

  // Show all free events
  console.log('  Free events found:\n');
  freeEvents.forEach((e: any, i: number) => printEvent(e, i));

  // ── Step 3: Pick the first free event ──
  const target = freeEvents[0];
  console.log('━━━ STEP 3: Selected target event ━━━\n');
  console.log(`  🎯 ${target.name}`);
  console.log(`  🔗 ${target.sourceUrl}`);
  console.log(`  📦 Source: ${target.source}`);
  console.log();

  if (dryRun) {
    console.log('  🔍 DRY RUN — skipping actual booking.\n');
    console.log('  To run the full test:  npx tsx src/test-booking.ts');
    console.log(`  To book this event:    npx tsx src/test-booking.ts --url "${target.sourceUrl}"`);
    return;
  }

  // ── Step 4: Execute booking ──
  console.log('━━━ STEP 4: Executing booking via Actionbook ━━━\n');
  console.log('  ⏳ This will open a browser, navigate, and attempt to register...\n');

  const startTime = Date.now();
  const bookingResult = await executeBookingTool.execute!({
    eventId: target.id ?? 'test-event',
    eventName: target.name,
    sourceUrl: target.sourceUrl,
    partySize,
    userProfile: {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+6591234567',
    },
    eventSource: target.source ?? 'unknown',
    bookingRequired: true,
  }, {} as any);
  const elapsed = Date.now() - startTime;

  // ── Step 5: Print result ──
  console.log('\n━━━ BOOKING RESULT ━━━\n');

  const statusIcons: Record<string, string> = {
    success: '✅',
    failed: '❌',
    skipped: '⏭️',
    sold_out: '🚫',
    login_required: '🔐',
    captcha_blocked: '🤖',
    payment_required: '💳',
    page_error: '🔥',
    timeout: '⏰',
    no_action_manual: '📖',
    no_source_url: '🔗',
  };

  const result = bookingResult as any;
  const icon = statusIcons[result.status] ?? '❓';

  console.log(`  Status:       ${icon} ${result.status}`);
  console.log(`  Action:       ${result.actionType}`);
  console.log(`  Event:        ${result.eventName}`);
  if (result.confirmationNumber) {
    console.log(`  Confirmation: ${result.confirmationNumber}`);
  }
  if (result.screenshotPath) {
    console.log(`  Screenshot:   ${result.screenshotPath}`);
  }
  if (result.error) {
    console.log(`  Error:        ${result.error}`);
  }
  console.log(`  Duration:     ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  Timestamp:    ${result.timestamp}`);
  console.log();

  // Full JSON for debugging
  console.log('  Full result JSON:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
