import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import {
  PlanFormDataSchema,
  EventSchema,
  EventCategorySchema,
  ItinerarySchema,
  mapPlanFormToConstraints,
  type Event,
  type Itinerary,
} from '../../types/index.js';

import { searchEventbriteTool } from '../tools/search-eventbrite.js';
import { searchEventfindaTool } from '../tools/search-eventfinda.js';
import { rankEventsTool } from '../tools/rank-events.js';
import { planItineraryTool } from '../tools/plan-itinerary.js';
import { deduplicateEventsTool } from '../tools/deduplicate-events.js';
import { executeBookingTool, type BookingResult } from '../tools/execute-booking.js';
import { recommendationAgent } from '../agents/recommendation.js';
import { planningAgent } from '../agents/planning.js';
import { traceEventBus, traceContext } from '../../tracing/index.js';
import type { TraceEvent } from '../../tracing/index.js';
import { contextRegistry } from '../../context/index.js';
import { waitForApproval } from '../../api/approval-registry.js';

function emitTrace(partial: Omit<TraceEvent, 'traceId'> & { traceId?: string }): void {
  const traceId = partial.traceId ?? traceContext.getStore() ?? 'unknown';
  traceEventBus.emit({ ...partial, traceId });
}

/** Tracks discovery start time per workflow run for accurate duration in completion trace */
const discoveryStartTimes = new Map<string, number>();

/** Tracks ranking start time per workflow run for accurate duration in completion trace */
const rankingStartTimes = new Map<string, number>();

/** Tracks planning start time per workflow run for accurate duration in completion trace */
const planningStartTimes = new Map<string, number>();

/** Format an ISO datetime string to HH:MM in Singapore Time (UTC+8) */
function formatSGT(isoString: string): string {
  const d = new Date(isoString);
  // Singapore is UTC+8 — offset in ms
  const sgtMs = d.getTime() + 8 * 60 * 60 * 1000;
  const sgt = new Date(sgtMs);
  const h = sgt.getUTCHours().toString().padStart(2, '0');
  const m = sgt.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Map timeOfDay enum to a concrete hour window string for the LLM */
const TIME_OF_DAY_WINDOWS: Record<string, { label: string; range: string }> = {
  morning:   { label: 'Morning',   range: '08:00–12:00' },
  afternoon: { label: 'Afternoon', range: '12:00–17:00' },
  evening:   { label: 'Evening',   range: '17:00–23:00' },
  night:     { label: 'Night',     range: '20:00–02:00' },
};

/** When timeOfDay is 'flexible', pick a sensible default window based on occasion */
const OCCASION_DEFAULT_WINDOWS: Record<string, { label: string; range: string }> = {
  date_night:       { label: 'Evening to Night', range: '17:00–23:00' },
  celebration:      { label: 'Evening to Night', range: '17:00–23:00' },
  friends_day_out:  { label: 'Afternoon to Evening', range: '12:00–22:00' },
  family_outing:    { label: 'Morning to Afternoon', range: '09:00–17:00' },
  solo_adventure:   { label: 'Morning to Evening', range: '09:00–21:00' },
  chill_hangout:    { label: 'Afternoon to Evening', range: '12:00–21:00' },
};

const FLEXIBLE_FALLBACK = { label: 'Daytime', range: '10:00–21:00' };

/** Map duration enum to concrete hour limits for tight scheduling */
const DURATION_HOURS: Record<string, number> = {
  '2_3_hours': 3,
  half_day: 4,
  full_day: 8,
};

/** Maximum idle gap (minutes) between consecutive activities */
const MAX_GAP_MINUTES = 45;

const intentStep = createStep({
  id: 'intent-understanding',
  description: 'Parses form data and uses Intent Agent LLM to enrich with category preferences',
  inputSchema: z.object({
    formData: PlanFormDataSchema,
    userQuery: z.string().optional().default(''),
  }),
  outputSchema: z.object({
    intentType: z.enum(['plan_date', 'plan_trip', 'find_events', 'book_specific', 'modify_plan']),
    constraints: z.record(z.any()),
    naturalLanguageSummary: z.string(),
    formData: z.record(z.any()),
    agentEnrichment: z.object({
      preferredCategories: z.array(EventCategorySchema).optional(),
      excludedCategories: z.array(EventCategorySchema).optional(),
      weatherSensitive: z.boolean().optional(),
      reasoning: z.string().optional(),
      confidence: z.number().optional(),
    }).optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { formData, userQuery } = inputData;
    const intentStartTime = Date.now();

    const mapped = mapPlanFormToConstraints(formData);

    emitTrace({
      id: `intent-started-${Date.now()}`,
      type: 'workflow_step',
      name: 'Understanding your request…',
      status: 'started',
      startedAt: new Date().toISOString(),
      metadata: {
        pipelineStep: 'intent',
        agentName: 'Intent Agent',
        agentStatus: 'Analyzing your preferences…',
        inputSummary: mapped.naturalLanguageSummary,
      },
    });

    console.log(`[pipeline:intent] 🧠 Intent Agent invoked`);
    console.log(`[pipeline:intent] Input: ${mapped.naturalLanguageSummary}`);

    let agentEnrichment: {
      preferredCategories?: z.infer<typeof EventCategorySchema>[];
      excludedCategories?: z.infer<typeof EventCategorySchema>[];
      weatherSensitive?: boolean;
      reasoning?: string;
      confidence?: number;
    } | undefined;

    try {
      const intentAgent = mastra.getAgent('intentAgent');
      const prompt = `User request: ${mapped.naturalLanguageSummary}${userQuery ? `\nAdditional context: ${userQuery}` : ''}\n\nOccasion: ${formData.occasion}\nBudget: ${formData.budgetRange}\nParty size: ${formData.partySize}\nTime: ${formData.timeOfDay}\nDuration: ${formData.duration}\nAreas: ${formData.areas.join(', ')}${formData.additionalNotes ? `\nNotes: ${formData.additionalNotes}` : ''}`;

      const response = await intentAgent.generate(prompt);
      const text = response.text.trim();

      console.log(`[pipeline:intent] Agent response: ${text}`);

      try {
        const parsed = JSON.parse(text);
        agentEnrichment = {
          preferredCategories: parsed.preferredCategories,
          excludedCategories: parsed.excludedCategories,
          weatherSensitive: parsed.weatherSensitive,
          reasoning: parsed.reasoning,
          confidence: parsed.confidence,
        };
        console.log(`[pipeline:intent] Enriched categories: ${agentEnrichment.preferredCategories?.join(', ') ?? 'none'}`);
        console.log(`[pipeline:intent] Confidence: ${agentEnrichment.confidence ?? 'unknown'}`);
        console.log(`[pipeline:intent] Reasoning: ${agentEnrichment.reasoning ?? 'none'}`);
      } catch {
        console.warn(`[pipeline:intent] Failed to parse agent JSON response, using deterministic mapping only`);
      }
    } catch (err) {
      console.warn(`[pipeline:intent] Agent enrichment failed: ${err instanceof Error ? err.message : String(err)}`);
      console.warn(`[pipeline:intent] Falling back to deterministic mapping only`);
    }

    const result = {
      intentType: mapped.intentType,
      constraints: mapped.constraints as Record<string, unknown>,
      naturalLanguageSummary: mapped.naturalLanguageSummary,
      formData: formData as unknown as Record<string, unknown>,
      agentEnrichment,
    };

    const intentDuration = Date.now() - intentStartTime;
    const categoriesStr = agentEnrichment?.preferredCategories?.join(', ') ?? 'general';
    const confidenceVal = agentEnrichment?.confidence;

    emitTrace({
      id: `intent-completed-${Date.now()}`,
      type: 'workflow_step',
      name: 'Intent understood',
      status: 'completed',
      startedAt: new Date(intentStartTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: intentDuration,
      metadata: {
        pipelineStep: 'intent',
        agentName: 'Intent Agent',
        agentStatus: 'Done — handing off to Discovery Agent',
        reasoning: agentEnrichment?.reasoning ?? `Mapped request to ${result.intentType} with categories: ${categoriesStr}`,
        confidence: confidenceVal,
        inputSummary: mapped.naturalLanguageSummary,
        outputSummary: `Type: ${result.intentType} | Categories: ${categoriesStr}`,
        reasoningSteps: [
          {
            label: 'Occasion analysis',
            detail: `Identified "${formData.occasion}" → intent type "${result.intentType}"`,
            status: 'pass' as const,
          },
          {
            label: 'Category mapping',
            detail: categoriesStr !== 'general'
              ? `Matched categories: ${categoriesStr}`
              : 'No specific category match — using general discovery',
            status: categoriesStr !== 'general' ? 'pass' : 'info',
          },
          {
            label: 'Budget constraint',
            detail: formData.budgetRange
              ? `Budget range "${formData.budgetRange}" applied as filter`
              : 'No budget constraint specified',
            status: 'info' as const,
          },
          {
            label: 'LLM enrichment',
            detail: agentEnrichment
              ? `GPT-4o-mini enriched with confidence ${Math.round((confidenceVal ?? 0) * 100)}%`
              : 'Skipped — using deterministic mapping only',
            status: agentEnrichment ? 'pass' : 'info',
          },
        ],
      },
    });

    console.log(`[pipeline:intent] ✅ Intent resolved: ${result.intentType}`);

    // ── Context: intent completed ──
    const _intentCtx = contextRegistry.get(traceContext.getStore() ?? '');
    void _intentCtx?.updateAgentState({ agentId: 'intent-agent', status: 'completed', timestamp: new Date().toISOString() }).catch(() => {});
    void _intentCtx?.updateWorkflowPhase('event_discovery').catch(() => {});
    return result;
  },
});

const searchEventbriteStep = createStep(searchEventbriteTool);
const searchEventfindaStep = createStep(searchEventfindaTool);

export const planningPipelineWorkflow = createWorkflow({
  id: 'planning-pipeline',
  inputSchema: z.object({
    formData: PlanFormDataSchema,
    userQuery: z.string().optional().default(''),
  }),
  outputSchema: z.object({
    events: z.array(EventSchema),
    rankedEvents: z.array(
      z.object({
        event: EventSchema,
        score: z.number(),
        reasoning: z.string(),
      }),
    ).optional(),
    filterStats: z.object({
      totalInput: z.number(),
      passedFilters: z.number(),
      finalCount: z.number(),
    }).optional(),
    intentSummary: z.string().optional(),
    agentReasoning: z.string().optional(),
    recommendationNarrative: z.string().optional(),
    dedupStats: z.object({
      originalCount: z.number(),
      deduplicatedCount: z.number(),
      removedCount: z.number(),
    }).optional(),
    itinerary: ItinerarySchema.optional(),
    planMetadata: z.object({
      itineraryName: z.string(),
      overallVibe: z.string().optional(),
      practicalTips: z.array(z.string()).optional(),
      weatherConsideration: z.string().optional(),
      budgetStatus: z.string(),
      budgetNotes: z.string().optional(),
      totalEstimatedCostPerPerson: z.number(),
      itemCount: z.number(),
      mainEventCount: z.number(),
      generatedActivityCount: z.number(),
    }).optional(),
    planWarnings: z.array(z.string()).optional(),
    bookingResults: z.array(z.object({
      eventId: z.string(),
      eventName: z.string(),
      actionType: z.enum(['check_availability', 'reserve', 'book', 'register', 'info_only']),
      status: z.enum([
        'success', 'failed', 'skipped', 'sold_out', 'login_required',
        'captcha_blocked', 'payment_required', 'page_error', 'timeout',
        'no_action_manual', 'no_source_url',
      ]),
      confirmationNumber: z.string().optional(),
      screenshotPath: z.string().optional(),
      error: z.string().optional(),
      timestamp: z.string(),
    })).optional(),
  }),
})
  .then(intentStep)

  .map(async ({ inputData }) => {
    const enrichedCategories = inputData.agentEnrichment?.preferredCategories;
    const deterministicCategories = (inputData.constraints as Record<string, unknown>)?.preferredCategories as string[] | undefined;
    const categories = enrichedCategories ?? deterministicCategories;

    const date = (inputData.formData as Record<string, unknown>).date as string;
    const areas = (inputData.formData as Record<string, unknown>).areas as string[];
    const budgetMax = ((inputData.constraints as Record<string, unknown>)?.budget as Record<string, unknown>)?.max as number | undefined;

    const discoveryStartTime = Date.now();
    const traceId = traceContext.getStore() ?? 'unknown';
    discoveryStartTimes.set(traceId, discoveryStartTime);

    emitTrace({
      id: `discovery-started-${Date.now()}`,
      type: 'workflow_step',
      name: 'Searching for events…',
      status: 'started',
      startedAt: new Date(discoveryStartTime).toISOString(),
      metadata: {
        pipelineStep: 'discovery',
        agentName: 'Discovery Agent',
        agentStatus: 'Searching Eventbrite & EventFinda…',
        inputSummary: `Date: ${date} | Budget: ${budgetMax ? `$${budgetMax}` : 'unlimited'} | Categories: ${categories?.join(', ') ?? 'all'} | Areas: ${areas?.join(', ') ?? 'anywhere'}`,
      },
    });

    console.log(`[pipeline:discovery] 🔍 Discovery starting`);
    // ── Context: discovery agent starting ──
    const _discStartCtx = contextRegistry.get(traceContext.getStore() ?? '');
    void _discStartCtx?.updateAgentState({ agentId: 'discovery-agent', status: 'running', timestamp: new Date().toISOString() }).catch(() => {});
    console.log(`[pipeline:discovery] Date: ${date}, Budget max: ${budgetMax ?? 'unlimited'}`);
    console.log(`[pipeline:discovery] Categories: ${categories?.join(', ') ?? 'all'}`);
    console.log(`[pipeline:discovery] Areas: ${areas?.join(', ') ?? 'anywhere'}`);
    console.log(`[pipeline:discovery] Searching 2 sources in parallel: Eventbrite, EventFinda`);

    return {
      date,
      categories,
      budgetMax,
      areas,
      maxResults: 20,
    };
  })

  .parallel([searchEventbriteStep, searchEventfindaStep])

  .map(async ({ inputData, getStepResult }) => {
    const eventbriteResult = inputData['search-eventbrite'] ?? { events: [] };
    const eventfindaResult = inputData['search-eventfinda'] ?? { events: [] };
    const rawEvents = [
      ...eventbriteResult.events,
      ...eventfindaResult.events,
    ];

    // Deduplicate merged events
    let allEvents = rawEvents;
    let dedupStats: { originalCount: number; deduplicatedCount: number; removedCount: number } | undefined;
    const dedupResult = await deduplicateEventsTool.execute!(
      { events: rawEvents },
      {} as any,
    );
    if (dedupResult && 'events' in dedupResult) {
      const dr = dedupResult as { events: typeof rawEvents; originalCount: number; deduplicatedCount: number; removedCount: number };
      allEvents = dr.events;
      dedupStats = {
        originalCount: dr.originalCount,
        deduplicatedCount: dr.deduplicatedCount,
        removedCount: dr.removedCount,
      };
    }

    // HallyuCon is injected as a guaranteed free RSVP event for the demo.
    // The execution agent needs at least one bookable free event to show the
    // end-to-end booking flow (open browser → fill form → confirm) without
    // hitting a paywall. HallyuCon is a real Eventbrite event with a free
    // "Reserve a spot" flow, making it ideal for a live demo.
    // ── Inject priority event: HallyuCon Mar '26 ──
    const hallyuConEvent: Event = {
      id: 'inject_hallyucon_mar26',
      name: "HallyuCon Mar '26",
      description: 'The ultimate Korean pop culture convention — K-pop, K-drama, Korean beauty, fashion, and food all in one place. Over 70 vendors, live stage performances, Random Play Dance, and more. Free RSVP gives entry on both days.',
      category: 'cultural',
      location: {
        name: 'Suntec Singapore Convention & Exhibition Centre, Hall 404',
        address: '1 Raffles Blvd, Suntec City, Singapore 039593',
        lat: 1.2932,
        lng: 103.8573,
      },
      timeSlot: {
        start: '2026-03-07T12:00:00+08:00',
        end: '2026-03-07T20:00:00+08:00',
      },
      price: { min: 0, max: 0, currency: 'SGD' },
      rating: 4.5,
      sourceUrl: 'https://www.eventbrite.sg/e/hallyucon-mar-26-rsvp-registration-tickets-1978865860057',
      source: 'eventbrite',
      availability: 'available',
      bookingRequired: true,
    };
    // Only inject if not already present (avoid duplicates on re-runs)
    if (!allEvents.some((e: { id?: string; sourceUrl?: string }) => e.id === hallyuConEvent.id || e.sourceUrl === hallyuConEvent.sourceUrl)) {
      allEvents.push(hallyuConEvent);
      console.log(`[pipeline:discovery] 📌 Injected priority event: ${hallyuConEvent.name}`);
    }

    console.log(`[pipeline:discovery] ✅ Discovery complete`);
    console.log(`[pipeline:discovery]   Eventbrite: ${eventbriteResult.events.length} events (${eventbriteResult.mode ?? 'unknown'} mode, ${eventbriteResult.searchDuration ?? 0}ms)`);
    console.log(`[pipeline:discovery]   EventFinda: ${eventfindaResult.events.length} events (${eventfindaResult.mode ?? 'unknown'} mode, ${eventfindaResult.searchDuration ?? 0}ms)`);
    console.log(`[pipeline:discovery]   Raw merged: ${rawEvents.length} events`);
    console.log(`[pipeline:discovery]   After dedup: ${allEvents.length} events${dedupStats ? ` (${dedupStats.removedCount} duplicates removed)` : ''}`);

    const topEventsStr = allEvents.slice(0, 5).map((e: { name: string; category?: string; price?: { min: number; max: number; currency: string } }, i: number) => {
      const priceStr = e.price ? `$${e.price.min}-${e.price.max} ${e.price.currency}` : 'free/unknown';
      return `${i + 1}. ${e.name} (${e.category ?? 'other'}, ${priceStr})`;
    }).join('\n');

    if (allEvents.length > 0) {
      console.log(`[pipeline:discovery] Top events:`);
      allEvents.slice(0, 5).forEach((e: { name: string; category?: string; price?: { min: number; max: number; currency: string } }, i: number) => {
        const priceStr = e.price ? `$${e.price.min}-${e.price.max} ${e.price.currency}` : 'free/unknown';
        console.log(`[pipeline:discovery]   ${i + 1}. ${e.name} (${e.category ?? 'other'}, ${priceStr})`);
      });
    }

    const intentResult = getStepResult(intentStep);
    const agentReasoning = intentResult?.agentEnrichment?.reasoning;
    const intentSummary = intentResult?.naturalLanguageSummary;

    const ebCount = eventbriteResult.events.length;
    const efCount = eventfindaResult.events.length;
    const ebMode = eventbriteResult.mode ?? 'unknown';
    const efMode = eventfindaResult.mode ?? 'unknown';

    const traceId = traceContext.getStore() ?? 'unknown';
    const discoveryStartTime = discoveryStartTimes.get(traceId) ?? Date.now();
    discoveryStartTimes.delete(traceId); // Clean up
    const discoveryDuration = Date.now() - discoveryStartTime;

    emitTrace({
      id: `discovery-completed-${Date.now()}`,
      type: 'workflow_step',
      name: `Found ${allEvents.length} events`,
      status: 'completed',
      startedAt: new Date(discoveryStartTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: discoveryDuration,
      metadata: {
        pipelineStep: 'discovery',
        agentName: 'Discovery Agent',
        agentStatus: allEvents.length > 0 ? 'Done — handing off to Recommendation Agent' : 'Complete — no events found',
        eventCount: allEvents.length,
        resultCount: allEvents.length,
        reasoning: `Searched Eventbrite (${ebMode}: ${ebCount} results) and EventFinda (${efMode}: ${efCount} results) in parallel. Merged ${allEvents.length} total events.`,
        outputSummary: topEventsStr || 'No events found',
        reasoningSteps: [
          {
            label: 'Eventbrite search',
            detail: `${ebCount} events via ${ebMode} mode`,
            status: ebCount > 0 ? 'pass' : 'fail',
          },
          {
            label: 'EventFinda search',
            detail: `${efCount} events via ${efMode} mode`,
            status: efCount > 0 ? 'pass' : 'fail',
          },
          {
            label: 'Merge',
            detail: `Combined ${rawEvents.length} raw events from 2 sources`,
            status: rawEvents.length > 0 ? 'pass' : 'fail',
          },
          {
            label: 'Deduplicate',
            detail: dedupStats
              ? `${dedupStats.originalCount} → ${dedupStats.deduplicatedCount} (${dedupStats.removedCount} duplicates removed)`
              : `${allEvents.length} events (dedup skipped)`,
            status: dedupStats && dedupStats.removedCount > 0 ? 'pass' : 'info',
          },
        ],
        decisions: allEvents.slice(0, 5).map((e: { name: string; category?: string; price?: { min: number; max: number; currency: string }; rating?: number; source?: string; timeSlot?: { start: string; end: string } }) => ({
          title: e.name,
          reason: `${e.category ?? 'other'} event from ${e.source ?? 'unknown'} — ${e.price ? `$${e.price.min}-${e.price.max} ${e.price.currency}` : 'free/unknown'}`,
          score: e.rating != null ? e.rating / 5 : undefined,
          data: { category: e.category, source: e.source, timeSlot: e.timeSlot },
        })),
      },
    });

    console.log(`[pipeline:discovery] ✅ Discovery complete — ${allEvents.length} events ready for ranking`);

    // ── Context: discovery completed ──
    const _discDoneCtx = contextRegistry.get(traceContext.getStore() ?? '');
    void _discDoneCtx?.storeDiscoveredEvents(allEvents as Event[]).catch(() => {});
    void _discDoneCtx?.updateAgentState({ agentId: 'discovery-agent', status: 'completed', timestamp: new Date().toISOString() }).catch(() => {});
    void _discDoneCtx?.updateWorkflowPhase('recommendation').catch(() => {});

    return {
      events: allEvents,
      intentSummary,
      agentReasoning,
      dedupStats,
      // Thread through constraint data for the ranking step
      constraints: intentResult?.constraints as Record<string, unknown> | undefined,
      agentEnrichment: intentResult?.agentEnrichment,
      formData: intentResult?.formData,
    };
  })

  // ── Step 3: Recommendation / Ranking ──
  .map(async ({ inputData }) => {
    const { events, intentSummary, agentReasoning, constraints, agentEnrichment, dedupStats, formData } = inputData;

    if (events.length === 0) {
      console.log(`[pipeline:ranking] ⏭️ No events to rank — skipping`);
      return {
        events,
        rankedEvents: undefined,
        filterStats: undefined,
        dedupStats,
        intentSummary,
        agentReasoning,
      };
    }

    const rankingStartTime = Date.now();
    const traceId = traceContext.getStore() ?? 'unknown';
    rankingStartTimes.set(traceId, rankingStartTime);
    // ── Context: recommendation agent starting ──
    const _rankStartCtx = contextRegistry.get(traceId);
    void _rankStartCtx?.updateAgentState({ agentId: 'recommendation-agent', status: 'running', timestamp: new Date().toISOString() }).catch(() => {});

    // Extract ranking inputs from intent constraints + agent enrichment
    const budgetMax = (constraints?.budget as Record<string, unknown>)?.max as number | undefined;
    const budgetMin = (constraints?.budget as Record<string, unknown>)?.min as number | undefined;
    const preferredCategories = agentEnrichment?.preferredCategories as string[] | undefined;
    const excludedCategories = agentEnrichment?.excludedCategories as string[] | undefined;
    const preferFreeEvents = (inputData.formData as Record<string, unknown>)?.preferFreeEvents === true;

    console.log(`[pipeline:ranking] 🏆 Ranking ${events.length} events`);
    console.log(`[pipeline:ranking]   Budget: $${budgetMin ?? 0}-${budgetMax ?? '∞'}`);
    console.log(`[pipeline:ranking]   Preferred: ${preferredCategories?.join(', ') ?? 'all'}`);
    console.log(`[pipeline:ranking]   Excluded: ${excludedCategories?.join(', ') ?? 'none'}`);

    emitTrace({
      id: `ranking-started-${Date.now()}`,
      type: 'workflow_step',
      name: 'Ranking events…',
      status: 'started',
      startedAt: new Date(rankingStartTime).toISOString(),
      metadata: {
        pipelineStep: 'recommendation',
        agentName: 'Recommendation Agent',
        agentStatus: 'Scoring events by budget, category, and rating…',
        inputSummary: `${events.length} events | Budget: $${budgetMin ?? 0}-${budgetMax ?? '∞'} | Categories: ${preferredCategories?.join(', ') ?? 'all'}`,
      },
    });

    // Call the ranking tool directly (same pattern as intent agent invocation)
    const rankResult = await rankEventsTool.execute!(
      {
        events,
        budgetMin,
        budgetMax,
        preferredCategories: preferredCategories as any,
        excludedCategories: excludedCategories as any,
        isOutdoorFriendly: undefined,
        preferFreeEvents,
      },
      {} as any,
    );

    if (!rankResult || 'error' in rankResult) {
      console.warn(`[pipeline:ranking] ⚠️ Ranking failed — returning unranked events. Error:`, JSON.stringify(rankResult, null, 2));
      const _rankFailCtx = contextRegistry.get(traceContext.getStore() ?? '');
      void _rankFailCtx?.addError('Ranking failed — returning unranked events').catch(() => {});
      return {
        events,
        rankedEvents: undefined,
        filterStats: undefined,
        dedupStats,
        intentSummary,
        agentReasoning,
      };
    }

    const { rankedEvents, filterStats } = rankResult as {
      rankedEvents: { event: Event; score: number; reasoning: string }[];
      filterStats: { totalInput: number; passedFilters: number; finalCount: number };
    };
    const rankingDuration = Date.now() - rankingStartTime;
    rankingStartTimes.delete(traceId);

    // Build top picks summary for trace
    const topPicks = rankedEvents.slice(0, 3);
    const topPicksStr = topPicks.map((r: { event: { name: string }; score: number }, i: number) =>
      `${i + 1}. ${r.event.name} (score: ${r.score})`,
    ).join('\n');

    console.log(`[pipeline:ranking] ✅ Ranking complete`);
    console.log(`[pipeline:ranking]   Input: ${filterStats.totalInput} → Filtered: ${filterStats.passedFilters} → Final: ${filterStats.finalCount}`);
    topPicks.forEach((r: { event: { name: string }; score: number }, i: number) => {
      console.log(`[pipeline:ranking]   ${i + 1}. ${r.event.name} — score ${r.score}`);
    });

    // ── Recommendation Agent: generate narrative reasoning for traces ──
    let agentNarrative: {
      narrative?: string;
      topPickReasoning?: { eventName: string; why: string }[];
      tradeoffs?: string[];
      confidence?: number;
    } = {};

    try {
      const reasoningPrompt = `User request: ${intentSummary ?? 'Plan an outing'}\nBudget: $${budgetMin ?? 0}-${budgetMax ?? '\u221e'}\nPreferred categories: ${preferredCategories?.join(', ') ?? 'all'}\nExcluded categories: ${excludedCategories?.join(', ') ?? 'none'}\n\nFilter stats: ${filterStats.totalInput} total \u2192 ${filterStats.passedFilters} passed hard filters \u2192 ${filterStats.finalCount} scored and ranked.\n\nTop ranked events:\n${topPicks.map((r: { event: { name: string; category?: string; price?: { min: number; max: number; currency: string } }; score: number; reasoning: string }, i: number) => `${i + 1}. ${r.event.name} (${r.event.category ?? 'other'}, ${r.event.price ? `$${r.event.price.min}-${r.event.price.max}` : 'free'}) \u2014 score ${r.score} \u2014 ${r.reasoning}`).join('\n')}`;

      console.log(`[pipeline:ranking] \ud83e\udd16 Recommendation Agent generating reasoning\u2026`);
      const response = await recommendationAgent.generate(reasoningPrompt);
      const text = response.text.trim();

      try {
        agentNarrative = JSON.parse(text);
        console.log(`[pipeline:ranking] Agent narrative: ${agentNarrative.narrative ?? '(none)'}`);
        console.log(`[pipeline:ranking] Agent confidence: ${agentNarrative.confidence ?? 'unknown'}`);
      } catch {
        // If JSON parsing fails, use raw text as narrative
        agentNarrative = { narrative: text };
        console.warn(`[pipeline:ranking] Agent returned non-JSON \u2014 using raw text as narrative`);
      }
    } catch (err) {
      console.warn(`[pipeline:ranking] Agent reasoning failed: ${err instanceof Error ? err.message : String(err)}`);
      console.warn(`[pipeline:ranking] Falling back to deterministic reasoning only`);
    }

    emitTrace({
      id: `ranking-completed-${Date.now()}`,
      type: 'workflow_step',
      name: `Top ${topPicks.length} picks`,
      status: 'completed',
      startedAt: new Date(rankingStartTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: rankingDuration,
      metadata: {
        pipelineStep: 'recommendation',
        agentName: 'Recommendation Agent',
        agentStatus: 'Done \u2014 events ranked and ready',
        resultCount: topPicks.length,
        reasoning: agentNarrative.narrative ?? `Scored ${filterStats.totalInput} events: ${filterStats.passedFilters} passed hard filters. Top ${topPicks.length} picks selected by budget fit (30%), category match (25%), rating (20%), availability (15%), weather (10%).`,
        confidence: agentNarrative.confidence,
        outputSummary: topPicksStr || 'No events passed filters',
        reasoningSteps: [
          {
            label: 'Hard-constraint filtering',
            detail: `${filterStats.totalInput} \u2192 ${filterStats.passedFilters} events (removed ${filterStats.totalInput - filterStats.passedFilters} sold-out, excluded, or over-budget)`,
            status: filterStats.passedFilters > 0 ? 'pass' : 'fail',
          },
          {
            label: 'Multi-factor scoring',
            detail: `Scored ${filterStats.finalCount} events on budget fit, category match, rating, availability, weather`,
            status: filterStats.finalCount > 0 ? 'pass' : 'fail',
          },
          {
            label: 'Top pick',
            detail: topPicks.length > 0
              ? `${topPicks[0].event.name} \u2014 score ${topPicks[0].score}/1.00`
              : 'No events to rank',
            status: topPicks.length > 0 ? 'pass' : 'info',
          },
          {
            label: 'Agent reasoning',
            detail: agentNarrative.narrative ?? 'Agent reasoning unavailable \u2014 using deterministic scoring only',
            status: agentNarrative.narrative ? 'pass' : 'info',
          },
          ...(agentNarrative.tradeoffs?.map(t => ({
            label: 'Trade-off',
            detail: t,
            status: 'info' as const,
          })) ?? []),
        ],
        decisions: topPicks.map((r: { event: { name: string; category?: string; price?: { min: number; max: number; currency: string }; timeSlot?: { start: string; end: string } }; score: number; reasoning: string }, i: number) => {
          const agentWhy = agentNarrative.topPickReasoning?.find(a => a.eventName === r.event.name)?.why;
          return {
            title: r.event.name,
            reason: agentWhy ?? r.reasoning,
            score: r.score,
            data: { category: r.event.category, price: r.event.price, timeSlot: r.event.timeSlot },
          };
        }),
      },
    });

    const top3 = rankedEvents.slice(0, 1);

    // ── Context: ranking completed ──
    const _rankDoneCtx = contextRegistry.get(traceContext.getStore() ?? '');
    void _rankDoneCtx?.storeRankedEvents(top3.map((r) => r.event)).catch(() => {});
    void _rankDoneCtx?.updateAgentState({ agentId: 'recommendation-agent', status: 'completed', timestamp: new Date().toISOString() }).catch(() => {});
    void _rankDoneCtx?.updateWorkflowPhase('itinerary_planning').catch(() => {});

    return {
      events,
      rankedEvents: top3,
      filterStats,
      dedupStats: inputData.dedupStats,
      intentSummary,
      agentReasoning: agentNarrative.narrative ?? agentReasoning,
      recommendationNarrative: agentNarrative.narrative,
      // Thread through data needed for planning step
      constraints,
      formData: inputData.formData,
    };
  })

  // ── Step 4: Itinerary Planning ──
  .map(async ({ inputData, mastra }) => {
    const {
      events,
      rankedEvents,
      filterStats,
      dedupStats,
      intentSummary,
      agentReasoning,
      recommendationNarrative,
      constraints,
      formData,
    } = inputData;

    // If no ranked events, skip planning
    if (!rankedEvents || rankedEvents.length === 0) {
      console.log(`[pipeline:planning] ⏭️ No ranked events — skipping itinerary planning`);
      return {
        events,
        rankedEvents,
        filterStats,
        dedupStats,
        intentSummary,
        agentReasoning,
        recommendationNarrative,
        itinerary: undefined,
        planMetadata: undefined,
        planWarnings: undefined,
      };
    }

    const planningStartTime = Date.now();
    const traceId = traceContext.getStore() ?? 'unknown';
    planningStartTimes.set(traceId, planningStartTime);

    // ── Context: planning agent starting ──
    const _planStartCtx = contextRegistry.get(traceId);
    void _planStartCtx?.updateAgentState({ agentId: 'planning-agent', status: 'running', timestamp: new Date().toISOString() }).catch(() => {});

    // Extract planning inputs
    const budgetMax = (constraints?.budget as Record<string, unknown>)?.max as number | undefined;
    const partySize = (constraints?.partySize as number) ?? 1;
    const date = (formData?.date as string) ?? new Date().toISOString().split('T')[0];
    const occasion = (formData?.occasion as string) ?? 'outing';
    const timeOfDay = (formData?.timeOfDay as string) ?? 'flexible';
    const duration = (formData?.duration as string) ?? 'half_day';
    const areas = (formData?.areas as string[]) ?? [];
    const additionalNotes = (formData?.additionalNotes as string) ?? '';

    console.log(`[pipeline:planning] 📋 Planning itinerary around top event: ${rankedEvents[0].event.name}`);
    console.log(`[pipeline:planning]   Budget: $${budgetMax ?? '∞'}/person | Party: ${partySize} | Date: ${date}`);
    console.log(`[pipeline:planning]   Time: ${timeOfDay} | Duration: ${duration} | Areas: ${areas.join(', ') || 'anywhere'}`);

    emitTrace({
      id: `planning-started-${Date.now()}`,
      type: 'workflow_step',
      name: 'Planning your itinerary…',
      status: 'started',
      startedAt: new Date(planningStartTime).toISOString(),
      metadata: {
        pipelineStep: 'planning',
        agentName: 'Planning Agent',
        agentStatus: 'Designing your perfect day plan…',
        inputSummary: `Top event: ${rankedEvents[0].event.name} | Budget: $${budgetMax ?? '∞'}/person | ${timeOfDay} ${duration.replace(/_/g, ' ')}`,
      },
    });

    // Build the prompt for the planning agent
    const topEventsDescription = rankedEvents.map((r: { event: Event; score: number; reasoning?: string }, i: number) => {
      const e = r.event;
      const priceStr = e.price ? `$${e.price.min}-${e.price.max} SGD` : 'free/unknown';
      const startSGT = e.timeSlot ? formatSGT(e.timeSlot.start) : null;
      const endSGT = e.timeSlot ? formatSGT(e.timeSlot.end) : null;
      const timeStr = startSGT && endSGT ? `${startSGT} - ${endSGT} SGT` : 'time flexible';
      return `${i + 1}. EXACT EVENT NAME: "${e.name}"
   Category: ${e.category}
   Location: ${e.location.name}, ${e.location.address}
   ⏰ EXACT TIME SLOT (copy these EXACTLY for startTime/endTime): startTime="${startSGT ?? 'flexible'}" endTime="${endSGT ?? 'flexible'}"
   Time (readable): ${timeStr}
   Price: ${priceStr}/person
   Rating: ${e.rating ?? 'unrated'}/5
   Score: ${r.score}/1.00
   Why: ${r.reasoning ?? 'Top pick'}`;
    }).join('\n\n');

    const timeWindow = timeOfDay === 'flexible' ? (OCCASION_DEFAULT_WINDOWS[occasion] ?? FLEXIBLE_FALLBACK) : (TIME_OF_DAY_WINDOWS[timeOfDay] ?? FLEXIBLE_FALLBACK);
    const totalGroupBudget = budgetMax != null ? budgetMax * partySize : undefined;

    const maxHours = DURATION_HOURS[duration] ?? 4;

    const planningPrompt = `Plan a complete ${occasion.replace(/_/g, ' ')} itinerary for ${date}.\n
TIME WINDOW: ${timeWindow.label} (${timeWindow.range}) — all activities MUST start and end within this window.
TOTAL PLAN DURATION: The entire plan (first activity start to last activity end) MUST NOT exceed ${maxHours} hours. This is a hard limit — do NOT spread activities across the full time window.
SCHEDULING RULE: Keep activities tightly clustered. Maximum ${MAX_GAP_MINUTES} minutes of idle/free time between any two consecutive activities (including travel). Aim for 15-30 minute gaps.\n
PARTY: ${partySize} ${partySize === 1 ? 'person' : 'people'}
BUDGET: $${budgetMax ?? 'unlimited'} per person (total group budget: $${totalGroupBudget ?? 'unlimited'} for ${partySize} ${partySize === 1 ? 'person' : 'people'})\n
PREFERRED AREAS: ${areas.join(', ') || 'anywhere in Singapore'}
${additionalNotes ? `NOTES: ${additionalNotes}` : ''}
${recommendationNarrative ? `RECOMMENDATION CONTEXT: ${recommendationNarrative}` : ''}\n
TOP RANKED EVENT (anchor your entire plan around this one event):
${topEventsDescription}

REMINDER: For the main event item, you MUST set:
- "name" to the EXACT EVENT NAME shown above (in quotes)
- "startTime" and "endTime" to the EXACT values shown in the ⏰ EXACT TIME SLOT above
- "isMainEvent" to true

Generate 3-4 total items (including the main event). All activities must end by 23:00. Create complementary activities matching the ${occasion.replace(/_/g, ' ')} vibe. All times in SGT (UTC+8). Keep the total span under ${maxHours} hours — schedule activities close together, not spread across the day.`;

    console.log(`[pipeline:planning] 🤖 Planning Agent generating itinerary…`);

    let llmPlan: Record<string, unknown> | undefined;

    try {
      const planAgent = mastra.getAgent('planningAgent');
      const response = await planAgent.generate(planningPrompt);
      const text = response.text.trim();

      console.log(`[pipeline:planning] Agent response length: ${text.length} chars`);

      try {
        llmPlan = JSON.parse(text);
        console.log(`[pipeline:planning] Parsed plan: "${(llmPlan as any)?.itineraryName ?? 'unnamed'}" with ${(llmPlan as any)?.items?.length ?? 0} items`);
      } catch {
        console.warn(`[pipeline:planning] Failed to parse agent JSON — trying to extract JSON from response`);
        // Try to extract JSON from markdown fencing or surrounding text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            llmPlan = JSON.parse(jsonMatch[0]);
            console.log(`[pipeline:planning] Extracted JSON plan: "${(llmPlan as any)?.itineraryName ?? 'unnamed'}"`);
          } catch {
            console.error(`[pipeline:planning] Could not extract valid JSON from agent response`);
          }
        }
      }
    } catch (err) {
      console.error(`[pipeline:planning] Planning agent failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Validate and structure with the tool ──
    let itinerary: Itinerary | undefined;
    let planMetadata: {
      itineraryName: string;
      overallVibe?: string;
      practicalTips?: string[];
      weatherConsideration?: string;
      budgetStatus: string;
      budgetNotes?: string;
      totalEstimatedCostPerPerson: number;
      itemCount: number;
      mainEventCount: number;
      generatedActivityCount: number;
    } | undefined;
    let planWarnings: string[] = [];

    if (llmPlan) {
      try {
        const toolResult = await planItineraryTool.execute!(
          {
            llmPlan,
            rankedEvents: rankedEvents as any,
            date,
            budgetMax,
            partySize,
            occasion,
          },
          {} as any,
        );

        if (toolResult && 'itinerary' in toolResult) {
          const result = toolResult as unknown as {
            itinerary: Itinerary;
            planMetadata: {
              itineraryName: string;
              overallVibe?: string;
              practicalTips?: string[];
              weatherConsideration?: string;
              budgetStatus: string;
              budgetNotes?: string;
              totalEstimatedCostPerPerson: number;
              itemCount: number;
              mainEventCount: number;
              generatedActivityCount: number;
            };
            warnings: string[];
          };
          itinerary = result.itinerary;
          planMetadata = result.planMetadata;
          planWarnings = result.warnings;

          console.log(`[pipeline:planning] ✅ Itinerary built: ${result.planMetadata?.itemCount} items`);
        } else {
          console.warn(`[pipeline:planning] Tool returned unexpected result:`, JSON.stringify(toolResult, null, 2));
          planWarnings.push('Itinerary tool returned unexpected result');
        }
      } catch (err) {
        console.error(`[pipeline:planning] Tool execution failed: ${err instanceof Error ? err.message : String(err)}`);
        planWarnings.push(`Tool failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      planWarnings.push('Planning agent did not return a valid plan — itinerary unavailable');
    }

    const planningDuration = Date.now() - planningStartTime;
    planningStartTimes.delete(traceId);

    // Build trace with planning results
    const itemCount = planMetadata?.itemCount ?? 0;
    const mainCount = planMetadata?.mainEventCount ?? 0;
    const genCount = planMetadata?.generatedActivityCount ?? 0;

    emitTrace({
      id: `planning-completed-${Date.now()}`,
      type: 'workflow_step',
      name: itinerary ? `${itemCount}-stop itinerary ready` : 'Planning incomplete',
      status: itinerary ? 'completed' : 'error',
      startedAt: new Date(planningStartTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: planningDuration,
      metadata: {
        pipelineStep: 'planning',
        agentName: 'Planning Agent',
        agentStatus: itinerary ? 'Done — itinerary ready for review' : 'Failed — could not generate itinerary',
        resultCount: itemCount,
        reasoning: planMetadata?.overallVibe ?? `Built ${itemCount}-activity itinerary (${mainCount} main events, ${genCount} complementary activities)`,
        confidence: itinerary ? 0.85 : 0.2,
        outputSummary: itinerary
          ? itinerary.items.map((item: { event: { name: string }; scheduledTime: { start: string } }, i: number) => {
              const time = formatSGT(item.scheduledTime.start);
              return `${i + 1}. ${time} — ${item.event.name}`;
            }).join('\n')
          : 'No itinerary generated',
        reasoningSteps: [
          {
            label: 'LLM plan generation',
            detail: llmPlan ? `Generated plan: "${planMetadata?.itineraryName ?? 'unnamed'}"` : 'Agent failed to produce valid plan',
            status: llmPlan ? 'pass' : 'fail',
          },
          {
            label: 'Schema validation',
            detail: itinerary ? `Validated ${itemCount} items against ItinerarySchema` : 'Validation failed or skipped',
            status: itinerary ? 'pass' : 'fail',
          },
          {
            label: 'Budget check',
            detail: planMetadata
              ? `$${planMetadata.totalEstimatedCostPerPerson}/person — ${planMetadata.budgetStatus.replace(/_/g, ' ')}`
              : 'Budget check skipped',
            status: planMetadata?.budgetStatus === 'within_budget' ? 'pass' : planMetadata?.budgetStatus === 'slightly_over' ? 'info' : planMetadata ? 'fail' : 'info',
          },
          {
            label: 'Activity mix',
            detail: planMetadata
              ? `${mainCount} main event(s) + ${genCount} complementary activities`
              : 'No activities planned',
            status: genCount > 0 ? 'pass' : 'info',
          },
          ...(planWarnings.map(w => ({
            label: 'Warning',
            detail: w,
            status: 'info' as const,
          }))),
        ],
        decisions: itinerary?.items.map((item: { event: { name: string; category?: string; price?: { min: number; max: number; currency: string } }; scheduledTime: { start: string; end: string }; notes?: string }) => ({
          title: item.event.name,
          reason: item.notes ?? `${item.event.category ?? 'activity'} at ${formatSGT(item.scheduledTime.start)} SGT`,
          score: undefined,
          data: {
            category: item.event.category,
            price: item.event.price,
            scheduledStart: item.scheduledTime.start,
            scheduledEnd: item.scheduledTime.end,
            scheduledTimeSGT: `${formatSGT(item.scheduledTime.start)} – ${formatSGT(item.scheduledTime.end)}`,
          },
        })),
      },
    });

    // ── Context: planning completed ──
    const _planDoneCtx = contextRegistry.get(traceContext.getStore() ?? '');
    if (itinerary) {
      void _planDoneCtx?.storeItinerary(itinerary).catch(() => {});
    }
    void _planDoneCtx?.updateAgentState({ agentId: 'planning-agent', status: itinerary ? 'completed' : 'failed', timestamp: new Date().toISOString() }).catch(() => {});
    void _planDoneCtx?.updateWorkflowPhase('plan_approval').catch(() => {});

    return {
      events,
      rankedEvents,
      filterStats,
      dedupStats,
      intentSummary,
      agentReasoning,
      recommendationNarrative,
      itinerary,
      planMetadata,
      planWarnings: planWarnings.length > 0 ? planWarnings : undefined,
    };
  })

  // ── Step 5: Plan Approval Gate ──
  .map(async ({ inputData }) => {
    const {
      events,
      rankedEvents,
      filterStats,
      dedupStats,
      intentSummary,
      agentReasoning,
      recommendationNarrative,
      itinerary,
      planMetadata,
      planWarnings,
    } = inputData;

    // If no itinerary was generated, skip approval gate
    if (!itinerary) {
      console.log(`[pipeline:approval] ⏭️ No itinerary — skipping approval gate`);
      return {
        events,
        rankedEvents,
        filterStats,
        dedupStats,
        intentSummary,
        agentReasoning,
        recommendationNarrative,
        itinerary,
        planMetadata,
        planWarnings,
        constraints: inputData.constraints,
        formData: inputData.formData,
      };
    }

    const traceId = traceContext.getStore() ?? 'unknown';
    const formData = inputData.formData as Record<string, unknown> | undefined;
    const constraints = inputData.constraints as Record<string, unknown> | undefined;
    const occasion = (formData?.occasion as string) ?? 'outing';
    const partySize = (constraints?.partySize as number) ?? 1;
    const budgetMax = (constraints?.budget as Record<string, unknown>)?.max as number | undefined;

    console.log(`[pipeline:approval] ⏸️  Awaiting user approval for itinerary: ${planMetadata?.itineraryName ?? 'unnamed'}`);

    // Emit the approval trace event with full itinerary data
    emitTrace({
      id: `approval-required-${Date.now()}`,
      type: 'plan_approval',
      name: 'Plan ready for approval',
      status: 'awaiting_approval',
      startedAt: new Date().toISOString(),
      metadata: {
        pipelineStep: 'planning',
        agentName: 'Planning Agent',
        agentStatus: 'Waiting for your approval…',
        approvalData: {
          itinerary: {
            id: itinerary.id,
            name: itinerary.name,
            date: itinerary.date,
            items: itinerary.items.map((item: { id: string; event: { name: string; category?: string; location: { name: string; address: string }; price?: { min: number; max: number; currency: string } }; scheduledTime: { start: string; end: string }; notes?: string }) => ({
              id: item.id,
              event: {
                name: item.event.name,
                category: item.event.category ?? 'activity',
                location: { name: item.event.location.name, address: item.event.location.address },
                price: item.event.price,
              },
              scheduledTime: item.scheduledTime,
              notes: item.notes,
            })),
            totalCost: itinerary.totalCost,
            totalDuration: itinerary.totalDuration,
          },
          planMetadata: {
            itineraryName: planMetadata?.itineraryName ?? itinerary.name,
            overallVibe: planMetadata?.overallVibe,
            practicalTips: planMetadata?.practicalTips,
            budgetStatus: planMetadata?.budgetStatus ?? 'unknown',
            budgetNotes: planMetadata?.budgetNotes,
            totalEstimatedCostPerPerson: planMetadata?.totalEstimatedCostPerPerson ?? itinerary.totalCost,
            itemCount: planMetadata?.itemCount ?? itinerary.items.length,
          },
          occasion,
          partySize,
          budgetMax,
        },
      },
    });

    // Wait for user approval (Promise resolves when POST /api/workflow/:id/approve is called)
    const approved = await waitForApproval(traceId);

    if (approved) {
      console.log(`[pipeline:approval] ✅ User approved the plan`);
      emitTrace({
        id: `approval-approved-${Date.now()}`,
        type: 'plan_approval',
        name: 'Plan approved',
        status: 'approved',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        metadata: {
          pipelineStep: 'planning',
          agentName: 'Planning Agent',
          agentStatus: 'Plan approved — proceeding to execution',
        },
      });
    } else {
      console.log(`[pipeline:approval] ❌ User rejected the plan`);
      emitTrace({
        id: `approval-rejected-${Date.now()}`,
        type: 'plan_approval',
        name: 'Plan rejected',
        status: 'rejected',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        metadata: {
          pipelineStep: 'planning',
          agentName: 'Planning Agent',
          agentStatus: 'Plan rejected by user',
        },
      });

      // Return early — pipeline stops here
      const _rejectCtx = contextRegistry.get(traceId);
      void _rejectCtx?.updateWorkflowPhase('completed').catch(() => {});
      return {
        events,
        rankedEvents,
        filterStats,
        dedupStats,
        intentSummary,
        agentReasoning,
        recommendationNarrative,
        itinerary: undefined,
        planMetadata: undefined,
        planWarnings: ['Plan rejected by user'],
        bookingResults: undefined,
        constraints,
        formData,
      };
    }

    // Approved — continue pipeline with full data
    return {
      events,
      rankedEvents,
      filterStats,
      dedupStats,
      intentSummary,
      agentReasoning,
      recommendationNarrative,
      itinerary,
      planMetadata,
      planWarnings,
      bookingResults: undefined as BookingResult[] | undefined,
      constraints,
      formData,
    };
  })

  // ── Step 6: Booking Execution ──
  .map(async ({ inputData }) => {
    const {
      events,
      rankedEvents,
      filterStats,
      dedupStats,
      intentSummary,
      agentReasoning,
      recommendationNarrative,
      itinerary,
      planMetadata,
      planWarnings,
      constraints,
      formData,
    } = inputData;

    // Extract partySize from constraints (threaded from form data)
    const partySize = (constraints as Record<string, unknown> | undefined)?.partySize as number ?? 1;

    // If no itinerary or it was rejected, pass through
    if (!itinerary || !itinerary.items || itinerary.items.length === 0) {
      return { ...inputData };
    }

    const traceId = traceContext.getStore() ?? 'unknown';
    const items = itinerary.items as Array<{
      id: string;
      event: {
        id: string;
        name: string;
        sourceUrl: string | null;
        source: string;
        category?: string;
        bookingRequired?: boolean;
      };
      notes?: string;
    }>;

    // Filter to items that are real discovered events (not LLM-generated) with a valid source URL
    const bookableItems = items.filter(
      (item) => item.event.source !== 'planned' && item.event.sourceUrl && item.event.sourceUrl.trim() !== '',
    );

    if (bookableItems.length === 0) {
      console.log(`[pipeline:execution] ⏭️ No bookable items — skipping execution`);
      emitTrace({
        id: `execution-skipped-${Date.now()}`,
        type: 'booking_execution',
        name: 'No bookable items',
        status: 'booking_completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        metadata: {
          pipelineStep: 'execution',
          agentName: 'Execution Agent',
          agentStatus: 'No items require booking — all are generated activities',
        },
      });
      return {
        events,
        rankedEvents,
        filterStats,
        dedupStats,
        intentSummary,
        agentReasoning,
        recommendationNarrative,
        itinerary,
        planMetadata,
        planWarnings,
        bookingResults: [] as BookingResult[],
      };
    }

    console.log(`[pipeline:execution] 🎯 Starting booking execution for ${bookableItems.length} items`);
    const executionStartTime = Date.now();

    emitTrace({
      id: `execution-started-${Date.now()}`,
      type: 'booking_execution',
      name: `Booking ${bookableItems.length} items…`,
      status: 'booking_started',
      startedAt: new Date().toISOString(),
      metadata: {
        pipelineStep: 'execution',
        agentName: 'Execution Agent',
        agentStatus: `Preparing to book ${bookableItems.length} items via Actionbook`,
        bookingData: {
          itemIndex: 0,
          totalItems: bookableItems.length,
          itemName: bookableItems[0]?.event.name ?? 'Unknown',
        },
      },
    });

    // ── Context: execution started ──
    const _execCtx = contextRegistry.get(traceId);
    void _execCtx?.updateAgentState({ agentId: 'execution-agent', status: 'running', timestamp: new Date().toISOString() }).catch(() => {});
    void _execCtx?.updateWorkflowPhase('booking_execution').catch(() => {});

    const bookingResults: BookingResult[] = [];

    // Fetch user profile from context (set by workflow route from Supabase)
    const userProfile = await _execCtx?.getCustomData<{
      name: string;
      email: string;
      phone: string;
      dietaryPreferences: string[];
      specialRequests: string;
    }>('userProfile') ?? { name: 'Guest', email: '', phone: '' };

    // Execute bookings sequentially (one browser at a time)
    for (let i = 0; i < bookableItems.length; i++) {
      const item = bookableItems[i]!;
      const itemStartTime = Date.now();

      console.log(`[pipeline:execution] 📋 Booking item ${i + 1}/${bookableItems.length}: ${item.event.name}`);

      emitTrace({
        id: `booking-item-${i}-${Date.now()}`,
        type: 'booking_execution',
        name: `Booking: ${item.event.name}`,
        status: 'booking_progress',
        startedAt: new Date().toISOString(),
        metadata: {
          pipelineStep: 'execution',
          agentName: 'Execution Agent',
          agentStatus: `Booking ${i + 1} of ${bookableItems.length}: ${item.event.name}`,
          bookingData: {
            itemIndex: i + 1,
            totalItems: bookableItems.length,
            itemName: item.event.name,
            sourceUrl: item.event.sourceUrl ?? undefined,
          },
        },
      });

      try {
        // Call executeBookingTool directly (not via agent — faster, more deterministic)
        const rawResult = await executeBookingTool.execute!({
          eventId: item.event.id,
          eventName: item.event.name,
          sourceUrl: item.event.sourceUrl ?? '',
          partySize,
          userProfile: {
            name: userProfile.name,
            email: userProfile.email,
            phone: userProfile.phone,
          },
          eventSource: item.event.source ?? 'unknown',
          bookingRequired: (item.event.bookingRequired as boolean) ?? true,
        }, {} as any);

        // Type-narrow: rawResult is ValidationError<any> | BookingResult
        if (!rawResult || !('eventId' in rawResult)) {
          bookingResults.push({
            eventId: item.event.id,
            eventName: item.event.name,
            actionType: 'book',
            status: 'failed',
            error: 'Tool returned validation error',
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        const result = rawResult as BookingResult;

        const bookingResult: BookingResult = {
          eventId: result.eventId,
          eventName: result.eventName,
          actionType: result.actionType,
          status: result.status,
          confirmationNumber: result.confirmationNumber,
          screenshotPath: result.screenshotPath,
          error: typeof result.error === 'string' ? result.error : undefined,
          timestamp: result.timestamp,
        };

        bookingResults.push(bookingResult);

        const itemDuration = Date.now() - itemStartTime;
        console.log(`[pipeline:execution] ${result.status === 'success' ? '✅' : '⚠️'} Item ${i + 1}: ${result.status} (${itemDuration}ms)`);

        emitTrace({
          id: `booking-item-done-${i}-${Date.now()}`,
          type: 'booking_execution',
          name: `${result.status === 'success' ? '✅' : '⚠️'} ${item.event.name}`,
          status: result.status === 'success' ? 'booking_completed' : 'booking_failed',
          startedAt: new Date(itemStartTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: itemDuration,
          metadata: {
            pipelineStep: 'execution',
            agentName: 'Execution Agent',
            agentStatus: `${result.status}: ${result.confirmationNumber ?? (typeof result.error === 'string' ? result.error : 'done')}`,
            bookingData: {
              itemIndex: i + 1,
              totalItems: bookableItems.length,
              itemName: item.event.name,
              sourceUrl: item.event.sourceUrl ?? undefined,
              confirmationNumber: result.confirmationNumber,
              screenshotPath: result.screenshotPath,
              bookingError: typeof result.error === 'string' ? result.error : undefined,
              actionManualFound: result.status !== 'no_action_manual',
            },
          },
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[pipeline:execution] ❌ Booking failed for ${item.event.name}:`, errMsg);

        bookingResults.push({
          eventId: item.event.id,
          eventName: item.event.name,
          actionType: 'book',
          status: 'failed',
          error: errMsg,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const executionDuration = Date.now() - executionStartTime;
    const successCount = bookingResults.filter((r) => r.status === 'success').length;
    const failedCount = bookingResults.filter((r) => r.status === 'failed').length;
    const skippedCount = bookingResults.filter((r) => ['skipped', 'no_source_url', 'no_action_manual', 'info_only'].includes(r.status)).length;

    console.log(`[pipeline:execution] 🏁 Execution complete: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped (${executionDuration}ms)`);

    emitTrace({
      id: `execution-completed-${Date.now()}`,
      type: 'booking_execution',
      name: `Execution complete`,
      status: 'booking_completed',
      startedAt: new Date(executionStartTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: executionDuration,
      metadata: {
        pipelineStep: 'execution',
        agentName: 'Execution Agent',
        agentStatus: `${successCount} booked, ${failedCount} failed, ${skippedCount} skipped`,
        resultCount: bookingResults.length,
        reasoning: `Processed ${bookableItems.length} bookable items: ${successCount} successful, ${failedCount} failed, ${skippedCount} skipped/info-only`,
        reasoningSteps: bookingResults.map((r) => ({
          label: r.eventName,
          detail: r.status === 'success'
            ? `Booked successfully${r.confirmationNumber ? ` (ref: ${r.confirmationNumber})` : ''}`
            : r.error ?? r.status,
          status: r.status === 'success' ? 'pass' as const : r.status === 'failed' ? 'fail' as const : 'info' as const,
        })),
      },
    });

    // ── Context: execution completed ──
    void _execCtx?.updateAgentState({ agentId: 'execution-agent', status: 'completed', timestamp: new Date().toISOString() }).catch(() => {});
    void _execCtx?.updateWorkflowPhase('completed').catch(() => {});

    return {
      events,
      rankedEvents,
      filterStats,
      dedupStats,
      intentSummary,
      agentReasoning,
      recommendationNarrative,
      itinerary,
      planMetadata,
      planWarnings,
      bookingResults,
    };
  })

  .commit();