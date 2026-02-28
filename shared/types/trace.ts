/**
 * Shared TraceEvent types — single source of truth for both backend and frontend.
 * Backend: src/tracing/sse-exporter.ts re-exports from here.
 * Frontend: ui/src/types/trace.ts re-exports from here.
 */

export interface ReasoningStep {
  label: string;
  detail: string;
  status?: 'pass' | 'fail' | 'info';
}

export interface Decision {
  title: string;
  reason: string;
  score?: number;
  data?: Record<string, unknown>;
}

export interface TraceEvent {
  id: string;
  traceId: string;
  parentId?: string;
  type:
    | 'agent_run'
    | 'tool_call'
    | 'workflow_run'
    | 'workflow_step'
    | 'workflow_parallel'
    | 'model_generation'
    | 'model_step'
    | 'plan_approval'
    | 'booking_execution'
    | 'generic';
  name: string;
  status: 'started' | 'running' | 'completed' | 'error' | 'awaiting_approval' | 'approved' | 'rejected' | 'booking_started' | 'booking_progress' | 'booking_completed' | 'booking_failed' | 'booking_skipped';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  metadata?: {
    reasoning?: string;
    confidence?: number;
    inputSummary?: string;
    outputSummary?: string;
    /** @deprecated Use resultCount instead */
    eventCount?: number;
    resultCount?: number;
    tokenUsage?: { prompt: number; completion: number; total: number };
    model?: string;
    pipelineStep?:
      | 'intent'
      | 'discovery'
      | 'recommendation'
      | 'planning'
      | 'execution';
    reasoningSteps?: ReasoningStep[];
    decisions?: Decision[];
    agentName?: string;
    agentStatus?: string;
    /** Itinerary data for plan approval events */
    approvalData?: {
      itinerary: {
        id: string;
        name: string;
        date: string;
        items: Array<{
          id: string;
          event: {
            name: string;
            category: string;
            location: { name: string; address: string };
            price?: { min: number; max: number; currency: string };
          };
          scheduledTime: { start: string; end: string };
          notes?: string;
        }>;
        totalCost: number;
        totalDuration: number;
      };
      planMetadata: {
        itineraryName: string;
        overallVibe?: string;
        practicalTips?: string[];
        budgetStatus: string;
        budgetNotes?: string;
        totalEstimatedCostPerPerson: number;
        itemCount: number;
      };
      occasion: string;
      partySize: number;
      budgetMax?: number;
    };
    /** Booking execution data for booking_execution events */
    bookingData?: {
      itemIndex: number;
      totalItems: number;
      itemName: string;
      sourceUrl?: string;
      confirmationNumber?: string;
      screenshotPath?: string;
      bookingError?: string;
      actionManualFound?: boolean;
    };
  };
  error?: string;
}

export type PipelineStep = NonNullable<NonNullable<TraceEvent['metadata']>['pipelineStep']>;
export type TraceStreamStatus = 'connecting' | 'connected' | 'done' | 'error';
