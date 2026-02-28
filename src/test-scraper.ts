import 'dotenv/config';
import { searchEventbriteTool } from './mastra/tools/search-eventbrite.js';

const TEST_NAMES = ['all', 'dining', 'budget', 'concert', 'week'] as const;
type TestName = (typeof TEST_NAMES)[number];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });
}

function formatPrice(price?: { min: number; max: number; currency: string }): string {
  if (!price) return 'Price not listed';
  if (price.min === 0 && price.max === 0) return 'Free';
  if (price.min === price.max) return `$${price.min} ${price.currency}`;
  return `$${price.min}–$${price.max} ${price.currency}`;
}

function formatAvailability(avail: string): string {
  const icons: Record<string, string> = {
    available: '✅ Available',
    limited: '⚠️  Limited',
    sold_out: '❌ Sold Out',
    unknown: '❓ Unknown',
  };
  return icons[avail] ?? avail;
}

function printEvent(event: any, index: number): void {
  const start = formatTime(event.timeSlot?.start);
  const end = formatTime(event.timeSlot?.end);
  const location = event.location;

  console.log(`  ${index + 1}. ${event.name}`);
  console.log(`     📅 ${start} → ${end}`);
  console.log(`     📍 ${location?.name ?? 'TBA'}${location?.address ? ` — ${location.address}` : ''}`);
  console.log(`     💰 ${formatPrice(event.price)}  |  ${formatAvailability(event.availability)}  |  🏷️  ${event.category}`);
  if (event.rating) console.log(`     ⭐ ${event.rating}/5`);
  console.log(`     🔗 ${event.sourceUrl}`);
  console.log();
}

function printResult(label: string, result: any): void {
  console.log(`  Mode: ${result.mode} | Found: ${result.events.length} events | Took: ${result.searchDuration}ms`);
  if (result.error) console.log(`  ⚠️  Fallback reason: ${result.error}`);
  console.log();
  (result as any).events.forEach((e: any, i: number) => printEvent(e, i));
}

function getDateStr(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

async function testAll(dateStr: string) {
  console.log(`━━━ All events from ${dateStr} (default +3 day range) ━━━\n`);
  const result = await searchEventbriteTool.execute!({
    date: dateStr,
    maxResults: 10,
  }, {} as any);
  printResult('All events', result);
}

async function testDining(dateStr: string) {
  console.log(`━━━ Dining events from ${dateStr} ━━━\n`);
  const result = await searchEventbriteTool.execute!({
    date: dateStr,
    categories: ['dining'],
    maxResults: 10,
  }, {} as any);
  printResult('Dining', result);
}

async function testBudget(dateStr: string) {
  console.log(`━━━ Budget max $50 from ${dateStr} ━━━\n`);
  const result = await searchEventbriteTool.execute!({
    date: dateStr,
    budgetMax: 50,
    maxResults: 10,
  }, {} as any);
  printResult('Budget ≤ $50', result);
}

async function testConcert(dateStr: string) {
  console.log(`━━━ Concert/music events from ${dateStr} ━━━\n`);
  const result = await searchEventbriteTool.execute!({
    date: dateStr,
    categories: ['concert'],
    maxResults: 10,
  }, {} as any);
  printResult('Concert/music', result);
}

async function testWeek(dateStr: string) {
  const weekEnd = new Date(dateStr);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  console.log(`━━━ 7-day range ${dateStr} → ${weekEndStr} ━━━\n`);
  const result = await searchEventbriteTool.execute!({
    date: dateStr,
    dateEnd: weekEndStr,
    maxResults: 15,
  }, {} as any);
  printResult('7-day range', result);
}

const TESTS: Record<TestName, (dateStr: string) => Promise<void>> = {
  all: testAll,
  dining: testDining,
  budget: testBudget,
  concert: testConcert,
  week: testWeek,
};

async function main() {
  const arg = process.argv[2] as TestName | undefined;

  const apiKey = process.env.BRIGHT_DATA_API_KEY;
  console.log(`  Bright Data API Key: ${apiKey ? '✅ SET' : '❌ NOT SET (demo mode)'}`);
  console.log(`  Bright Data Zone:    ${process.env.BRIGHT_DATA_ZONE ?? '(default)'}\n`);

  const dateStr = getDateStr();

  if (!arg) {
    console.log(`Usage: npx tsx src/test-scraper.ts <test>\n`);
    console.log(`Available tests: ${TEST_NAMES.join(', ')}\n`);
    console.log(`  all     — All events (default +3 day range)`);
    console.log(`  dining  — Dining category only`);
    console.log(`  budget  — Budget max $50`);
    console.log(`  concert — Concert/music category`);
    console.log(`  week    — 7-day date range`);
    process.exit(0);
  }

  const testFn = TESTS[arg];
  if (!testFn) {
    console.error(`Unknown test: "${arg}". Available: ${TEST_NAMES.join(', ')}`);
    process.exit(1);
  }

  await testFn(dateStr);
  console.log('✓ Done');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
