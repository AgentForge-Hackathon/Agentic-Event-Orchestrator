/**
 * Full pipeline end-to-end test:
 *   Intent → Discovery → Ranking/Recommendation → Planning → Auto-Approve → Execution
 *
 * Invokes the Mastra workflow directly (no server needed).
 * Auto-approves the plan so execution runs.
 * Logs key data at each step to verify data flows correctly (sourceUrl, partySize, userProfile).
 *
 * Usage:
 *   npx tsx src/test-pipeline-e2e.ts                    # full e2e with real booking
 *   npx tsx src/test-pipeline-e2e.ts --dry-run           # stops at approval (no execution)
 *   npx tsx src/test-pipeline-e2e.ts --party 2           # set party size
 */

import 'dotenv/config';

import { mastra } from './mastra/index.js';
import { traceContext } from './tracing/index.js';
import { traceEventBus } from './tracing/index.js';
import { createContextManager, contextRegistry } from './context/index.js';
import { resolveApproval, hasPendingApproval } from './api/approval-registry.js';
import type { TraceEvent } from './tracing/index.js';

// ── CLI args ──
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const partyIndex = args.indexOf('--party');
const partySize = partyIndex !== -1 ? parseInt(args[partyIndex + 1] ?? '2', 10) : 2;

// ── Test form data (simulates what the frontend sends) ──
const testFormData = {
  occasion: 'friends_day_out' as const,
  budgetRange: 'free' as const,
  partySize,
  date: (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0]!;
  })(),
  timeOfDay: 'afternoon' as const,
  duration: 'half_day' as const,
  areas: ['central'],
  additionalNotes: 'Something fun and free',
  preferFreeEvents: false,
};

// ── Test user profile (simulates what the workflow route fetches from Supabase) ──
const testUserProfile = {
  name: 'Jared Kong',
  email: 'jared@example.com',
  phone: '+6591234567',
  dietaryPreferences: [],
  specialRequests: '',
};

// ── Helpers ──
function divider(title: string) {
  console.log(`\n${'━'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'━'.repeat(60)}\n`);
}

function formatEvent(event: Record<string, unknown>, index: number) {
  console.log(`  ${index + 1}. ${event.name}`);
  console.log(`     🔗 sourceUrl: ${event.sourceUrl ?? '(none)'}`);
  console.log(`     📦 source: ${event.source}`);
  console.log(`     🏷️  category: ${event.category}`);
  const price = event.price as Record<string, unknown> | undefined;
  if (price) {
    console.log(`     💰 price: $${price.min}–$${price.max} ${price.currency}`);
  }
  console.log(`     🎫 bookingRequired: ${event.bookingRequired ?? 'unknown'}`);
  console.log();
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   🚀 FULL PIPELINE E2E TEST                  ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  console.log(`  Mode:        ${dryRun ? '🔍 DRY RUN (stops at approval)' : '🚀 FULL (through execution)'}`);
  console.log(`  Party size:  ${partySize}`);
  console.log(`  Occasion:    ${testFormData.occasion}`);
  console.log(`  Budget:      ${testFormData.budgetRange}`);
  console.log(`  Date:        ${testFormData.date}`);
  console.log(`  Time:        ${testFormData.timeOfDay}`);
  console.log(`  Duration:    ${testFormData.duration}`);
  console.log(`  User:        ${testUserProfile.name} (${testUserProfile.email})`);
  console.log();

  // ── Set up workflow ──
  const workflow = mastra.getWorkflow('planningPipelineWorkflow');
  const run = await workflow.createRun();
  const workflowId = run.runId;

  console.log(`  Workflow ID: ${workflowId}`);

  // ── Set up context manager (mirrors what workflow route does) ──
  const ctx = createContextManager();
  void ctx.initializeWorkflow('test-user-id').catch(() => {});
  contextRegistry.set(workflowId, ctx);

  // Store user profile (execution step reads this)
  void ctx.setCustomData('userProfile', testUserProfile).catch(() => {});

  // ── Listen to trace events for logging ──
  const traceEvents: TraceEvent[] = [];
  const unsubscribe = traceEventBus.subscribe(workflowId, (event: TraceEvent) => {
    traceEvents.push(event);

    // Log interesting events
    const step = (event.metadata as Record<string, unknown>)?.pipelineStep as string | undefined;
    const agentStatus = (event.metadata as Record<string, unknown>)?.agentStatus as string | undefined;
    if (step && agentStatus) {
      const icon = event.status === 'completed' ? '✅' :
                   event.status === 'error' ? '❌' :
                   event.status === 'started' ? '🔄' :
                   event.status === 'awaiting_approval' ? '⏸️' :
                   '📋';
      console.log(`  ${icon} [${step}] ${agentStatus}`);
    }
  });

  // ── Auto-approval watcher ──
  // Poll for the approval gate and auto-approve (or skip if dry-run)
  let approvalResolved = false;
  const approvalWatcher = setInterval(() => {
    if (approvalResolved) return;
    if (hasPendingApproval(workflowId)) {
      approvalResolved = true;
      if (dryRun) {
        divider('APPROVAL GATE REACHED — DRY RUN, REJECTING');
        console.log('  Pipeline would pause here for user approval.');
        console.log('  In dry-run mode, rejecting to stop pipeline.\n');

        // Print what we know so far from traces
        const planApprovalEvent = traceEvents.find(e => e.type === 'plan_approval');
        if (planApprovalEvent) {
          const approvalData = (planApprovalEvent.metadata as Record<string, unknown>)?.approvalData as Record<string, unknown> | undefined;
          if (approvalData) {
            const itinerary = approvalData.itinerary as Record<string, unknown> | undefined;
            const items = itinerary?.items as Array<Record<string, unknown>> | undefined;
            if (items) {
              console.log(`  Itinerary: ${itinerary?.name} (${items.length} items)\n`);
              items.forEach((item, i) => {
                const event = item.event as Record<string, unknown>;
                console.log(`  ${i + 1}. ${event?.name}`);
                console.log(`     Time: ${(item.scheduledTime as Record<string, unknown>)?.start} → ${(item.scheduledTime as Record<string, unknown>)?.end}`);
                console.log();
              });
            }
          }
        }

        resolveApproval(workflowId, false);
      } else {
        divider('APPROVAL GATE REACHED — AUTO-APPROVING');
        console.log('  ✅ Auto-approving to test execution step...\n');
        resolveApproval(workflowId, true);
      }
    }
  }, 500);

  // ── Run the pipeline ──
  divider('STARTING PIPELINE');
  const startTime = Date.now();

  const result = await traceContext.run(workflowId, async () => {
    return run.start({
      inputData: { formData: testFormData, userQuery: '' },
    });
  });

  clearInterval(approvalWatcher);
  unsubscribe();

  const elapsed = Date.now() - startTime;

  // ── Print results ──
  divider('PIPELINE RESULT');
  console.log(`  Status:   ${result.status}`);
  console.log(`  Duration: ${(elapsed / 1000).toFixed(1)}s`);
  console.log();

  if (result.status !== 'success') {
    console.log('  ❌ Pipeline did not succeed.\n');
    console.log('  Steps:', JSON.stringify(result.steps, null, 2));
    cleanup(workflowId);
    return;
  }

  const data = result.result as Record<string, unknown>;

  // ── Events discovered ──
  const events = data.events as Array<Record<string, unknown>> | undefined;
  const rankedEvents = data.rankedEvents as Array<Record<string, unknown>> | undefined;
  console.log(`  Events discovered: ${events?.length ?? 0}`);
  console.log(`  Ranked events:     ${rankedEvents?.length ?? 0}`);
  console.log();

  // ── Itinerary ──
  const itinerary = data.itinerary as Record<string, unknown> | undefined;
  if (itinerary) {
    const items = itinerary.items as Array<Record<string, unknown>> | undefined;
    divider('ITINERARY');
    console.log(`  Name:     ${itinerary.name}`);
    console.log(`  Items:    ${items?.length ?? 0}`);
    console.log(`  Cost:     ${JSON.stringify(itinerary.totalCost)}`);
    console.log(`  Duration: ${itinerary.totalDuration}min`);
    console.log();

    if (items) {
      items.forEach((item, i) => {
        const event = item.event as Record<string, unknown>;
        const time = item.scheduledTime as Record<string, unknown>;
        console.log(`  ${i + 1}. ${event?.name}`);
        console.log(`     🔗 sourceUrl: ${event?.sourceUrl ?? '(none)'}`);
        console.log(`     📦 source:    ${event?.source ?? '(unknown)'}`);
        console.log(`     🎫 booking:   ${event?.bookingRequired ?? 'unknown'}`);
        console.log(`     ⏰ time:      ${time?.start} → ${time?.end}`);
        console.log(`     📝 notes:     ${item.notes ?? '(none)'}`);
        console.log();
      });
    }
  } else {
    console.log('  (No itinerary — plan was rejected or not generated)\n');
  }

  // ── Booking results (the key verification) ──
  const bookingResults = data.bookingResults as Array<Record<string, unknown>> | undefined;
  if (bookingResults && bookingResults.length > 0) {
    divider('BOOKING RESULTS (EXECUTION STEP OUTPUT)');
    console.log(`  Total bookings attempted: ${bookingResults.length}\n`);

    const statusIcons: Record<string, string> = {
      success: '✅', failed: '❌', skipped: '⏭️', sold_out: '🚫',
      login_required: '🔐', captcha_blocked: '🤖', payment_required: '💳',
      page_error: '🔥', timeout: '⏰', no_action_manual: '📖', no_source_url: '🔗',
    };

    bookingResults.forEach((br, i) => {
      const icon = statusIcons[br.status as string] ?? '❓';
      console.log(`  ${i + 1}. ${br.eventName}`);
      console.log(`     Status:       ${icon} ${br.status}`);
      console.log(`     Action:       ${br.actionType}`);
      console.log(`     Source URL:    ${br.sourceUrl ?? '(not in result)'}`);
      if (br.confirmationNumber) {
        console.log(`     Confirmation: ${br.confirmationNumber}`);
      }
      if (br.screenshotPath) {
        console.log(`     Screenshot:   ${br.screenshotPath}`);
      }
      if (br.error) {
        console.log(`     Error:        ${br.error}`);
      }
      console.log();
    });
  } else if (!dryRun && itinerary) {
    console.log('  ⚠️  No booking results — execution step may have been skipped (no bookable items).\n');
  }

  // ── Verification summary ──
  divider('DATA FLOW VERIFICATION');

  // Check constraints.partySize made it through
  const constraints = data.constraints as Record<string, unknown> | undefined;
  const threadedPartySize = constraints?.partySize;
  console.log(`  partySize in form:        ${testFormData.partySize}`);
  console.log(`  partySize in constraints: ${threadedPartySize ?? '(missing)'}`);
  console.log(`  partySize match:          ${threadedPartySize === testFormData.partySize ? '✅' : '❌'}`);
  console.log();

  // Check sourceUrls in itinerary items
  if (itinerary) {
    const items = itinerary.items as Array<Record<string, unknown>> | undefined;
    const itemsWithUrl = items?.filter(item => {
      const event = item.event as Record<string, unknown>;
      return event?.sourceUrl && (event.sourceUrl as string).startsWith('http');
    }) ?? [];
    const itemsWithoutUrl = items?.filter(item => {
      const event = item.event as Record<string, unknown>;
      return !event?.sourceUrl || !(event.sourceUrl as string).startsWith('http');
    }) ?? [];
    console.log(`  Itinerary items with sourceUrl:    ${itemsWithUrl.length}`);
    console.log(`  Itinerary items without sourceUrl: ${itemsWithoutUrl.length}`);

    if (itemsWithoutUrl.length > 0) {
      console.log('  Items missing sourceUrl:');
      itemsWithoutUrl.forEach((item) => {
        const event = item.event as Record<string, unknown>;
        console.log(`    - ${event?.name} (sourceUrl: ${event?.sourceUrl ?? 'null'})`);
      });
    }
    console.log();
  }

  // Check user profile was accessible
  const storedProfile = await ctx.getCustomData<typeof testUserProfile>('userProfile');
  console.log(`  userProfile in context:   ${storedProfile ? '✅ present' : '❌ missing'}`);
  if (storedProfile) {
    console.log(`    name:  ${storedProfile.name}`);
    console.log(`    email: ${storedProfile.email}`);
    console.log(`    phone: ${storedProfile.phone}`);
  }
  console.log();

  cleanup(workflowId);
}

function cleanup(workflowId: string) {
  contextRegistry.delete(workflowId);
  console.log('  🧹 Cleaned up context registry.\n');

  // Give a moment for any async cleanup, then exit
  setTimeout(() => process.exit(0), 1000);
}

main().catch((err) => {
  console.error('\n❌ Pipeline test failed:', err);
  process.exit(1);
});
