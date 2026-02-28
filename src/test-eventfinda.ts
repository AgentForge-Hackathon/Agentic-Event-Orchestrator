import 'dotenv/config';
import { searchEventfindaTool } from './mastra/tools/search-eventfinda.js';

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
  return `$${price.min}\u2013$${price.max} ${price.currency}`;
}

function formatAvailability(avail: string): string {
  const icons: Record<string, string> = {
    available: '\u2705 Available',
    limited: '\u26a0\ufe0f  Limited',
    sold_out: '\u274c Sold Out',
    unknown: '\u2753 Unknown',
  };
  return icons[avail] ?? avail;
}

function printEvent(event: any, index: number): void {
  const start = formatTime(event.timeSlot?.start);
  const end = formatTime(event.timeSlot?.end);
  const location = event.location;

  console.log(`  ${index + 1}. ${event.name}`);
  console.log(`     \ud83d\udcc5 ${start} \u2192 ${end}`);
  console.log(`     \ud83d\udccd ${location?.name ?? 'TBA'}${location?.address ? ` \u2014 ${location.address}` : ''}`);
  console.log(`     \ud83d\udcb0 ${formatPrice(event.price)}  |  ${formatAvailability(event.availability)}  |  \ud83c\udff7\ufe0f  ${event.category}`);
  if (event.rating) console.log(`     \u2b50 ${event.rating}/5`);
  console.log(`     \ud83d\udd17 ${event.sourceUrl}`);
  console.log();
}

function printResult(result: any): void {
  console.log(`  Mode: ${result.mode} | Found: ${result.events.length} events | Took: ${result.searchDuration}ms`);
  if (result.error) console.log(`  \u26a0\ufe0f  Fallback reason: ${result.error}`);
  console.log();
  (result as any).events.forEach((e: any, i: number) => printEvent(e, i));
}

function getDateStr(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

async function testAll(dateStr: string) {
  console.log(`\u2501\u2501\u2501 All events from ${dateStr} (default +3 day range) \u2501\u2501\u2501\n`);
  const result = await searchEventfindaTool.execute!({
    date: dateStr,
    maxResults: 10,
  }, {} as any);
  printResult(result);
}

async function testDining(dateStr: string) {
  console.log(`\u2501\u2501\u2501 Dining events from ${dateStr} \u2501\u2501\u2501\n`);
  const result = await searchEventfindaTool.execute!({
    date: dateStr,
    categories: ['dining'],
    maxResults: 10,
  }, {} as any);
  printResult(result);
}

async function testBudget(dateStr: string) {
  console.log(`\u2501\u2501\u2501 Budget max $50 from ${dateStr} \u2501\u2501\u2501\n`);
  const result = await searchEventfindaTool.execute!({
    date: dateStr,
    budgetMax: 50,
    maxResults: 10,
  }, {} as any);
  printResult(result);
}

async function testConcert(dateStr: string) {
  console.log(`\u2501\u2501\u2501 Concert/music events from ${dateStr} \u2501\u2501\u2501\n`);
  const result = await searchEventfindaTool.execute!({
    date: dateStr,
    categories: ['concert'],
    maxResults: 10,
  }, {} as any);
  printResult(result);
}

async function testWeek(dateStr: string) {
  const weekEnd = new Date(dateStr);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  console.log(`\u2501\u2501\u2501 7-day range ${dateStr} \u2192 ${weekEndStr} \u2501\u2501\u2501\n`);
  const result = await searchEventfindaTool.execute!({
    date: dateStr,
    dateEnd: weekEndStr,
    maxResults: 15,
  }, {} as any);
  printResult(result);
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

  const username = process.env.EVENTFINDA_USERNAME;
  const password = process.env.EVENTFINDA_PASSWORD;
  console.log(`  EventFinda Username: ${username ? '\u2705 SET' : '\u274c NOT SET (demo mode)'}`);
  console.log(`  EventFinda Password: ${password ? '\u2705 SET' : '\u274c NOT SET (demo mode)'}\n`);

  const dateStr = getDateStr();

  if (!arg) {
    console.log(`Usage: npx tsx src/test-eventfinda.ts <test>\n`);
    console.log(`Available tests: ${TEST_NAMES.join(', ')}\n`);
    console.log(`  all     \u2014 All events (default +3 day range)`);
    console.log(`  dining  \u2014 Dining category only`);
    console.log(`  budget  \u2014 Budget max $50`);
    console.log(`  concert \u2014 Concert/music category`);
    console.log(`  week    \u2014 7-day date range`);
    process.exit(0);
  }

  const testFn = TESTS[arg];
  if (!testFn) {
    console.error(`Unknown test: "${arg}". Available: ${TEST_NAMES.join(', ')}`);
    process.exit(1);
  }

  await testFn(dateStr);
  console.log('\u2713 Done');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});