/**
 * Persistence strategy: write-through cache over Acontext Sessions.
 *
 * Reads always hit the in-memory Map (zero-latency, synchronous).
 * Writes update memory first, then fire-and-forget a storeMessage call to Acontext.
 * Acontext failures are caught and logged — they never interrupt the workflow.
 * Falls back to pure in-memory when ACONTEXT_API_KEY is unset.
 *
 * Acontext session layout (one per workflow run):
 *   Each state mutation appends a role:"system" OpenAI message tagged with
 *   meta.type (e.g. "phase_transition", "agent_state_updated"), making the full
 *   workflow trajectory inspectable in the Acontext Dashboard.
 */

import { AcontextClient } from '@acontext/acontext';
import type {
  BookingAction,
  Event,
  Itinerary,
  UserIntent,
  WorkflowState,
} from '../types/index.js';

export interface ContextConfig {
  /** Falls back to ACONTEXT_API_KEY env var. */
  apiKey?: string;
  /** Override for self-hosted Acontext. Falls back to ACONTEXT_BASE_URL env var. */
  baseUrl?: string;
}

export interface AgentStateUpdate {
  agentId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastOutput?: unknown;
  error?: string;
  timestamp: string;
}

export interface WorkflowPhase {
  phase: WorkflowState['currentPhase'];
  startedAt: string;
  completedAt?: string;
  output?: unknown;
}

export class ContextManager {
  private sessionId: string | null = null;
  private workflowId: string | null = null;

  /**
   * Acontext session UUID — distinct from workflowId.
   * Only available after initializeWorkflow's async session creation completes.
   * Do not read this synchronously right after initializeWorkflow; it may still be null.
   */
  private acontextSessionId: string | null = null;

  private localState: Map<string, unknown> = new Map();
  private readonly config: ContextConfig;
  private readonly client?: AcontextClient;

  constructor(config?: ContextConfig) {
    this.config = config ?? {};

    const apiKey = config?.apiKey ?? process.env['ACONTEXT_API_KEY'];
    const baseUrl = config?.baseUrl ?? process.env['ACONTEXT_BASE_URL'];

    if (apiKey) {
      this.client = new AcontextClient({
        apiKey,
        ...(baseUrl ? { baseUrl } : {}),
      });
    } else {
      console.log('[context] ACONTEXT_API_KEY not set — running in-memory only');
    }
  }

  async initializeWorkflow(
    userId: string,
    initialIntent?: UserIntent,
  ): Promise<string> {
    this.workflowId = `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.sessionId = `session-${Date.now()}`;

    const initialState: WorkflowState = {
      workflowId: this.workflowId,
      currentPhase: 'intent_parsing',
      userIntent: initialIntent,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.localState.set('workflow', initialState);
    this.localState.set('agents', new Map<string, AgentStateUpdate>());
    this.localState.set('phases', [] as WorkflowPhase[]);

    void this.initAcontextSession(userId, initialState);

    return this.workflowId;
  }

  async updateWorkflowPhase(
    phase: WorkflowState['currentPhase'],
    output?: unknown,
  ): Promise<void> {
    const workflow = this.localState.get('workflow') as WorkflowState;
    const phases = this.localState.get('phases') as WorkflowPhase[];

    const currentPhaseRecord = phases.find(
      (p) => p.phase === workflow.currentPhase && !p.completedAt,
    );
    if (currentPhaseRecord) {
      currentPhaseRecord.completedAt = new Date().toISOString();
      currentPhaseRecord.output = output;
    }

    const previousPhase = workflow.currentPhase;
    workflow.currentPhase = phase;
    workflow.updatedAt = new Date().toISOString();

    phases.push({ phase, startedAt: new Date().toISOString() });

    this.localState.set('workflow', workflow);
    this.localState.set('phases', phases);

    void this.persistEvent('phase_transition', {
      fromPhase: previousPhase,
      toPhase: phase,
      output: output ?? null,
      workflowState: workflow,
    });
  }

  async updateAgentState(update: AgentStateUpdate): Promise<void> {
    const agents = this.localState.get('agents') as Map<string, AgentStateUpdate>;
    agents.set(update.agentId, update);
    this.localState.set('agents', agents);
    void this.persistEvent('agent_state_updated', update);
  }

  async storeDiscoveredEvents(events: Event[]): Promise<void> {
    const workflow = this.localState.get('workflow') as WorkflowState;
    workflow.discoveredEvents = events;
    workflow.updatedAt = new Date().toISOString();
    this.localState.set('workflow', workflow);

    void this.persistEvent('events_discovered', {
      eventCount: events.length,
      eventSummaries: events.slice(0, 10).map((e) => ({
        id: e.id,
        name: e.name,
        category: e.category,
        source: e.source,
      })),
      workflowState: workflow,
    });
  }

  async storeRankedEvents(events: Event[]): Promise<void> {
    const workflow = this.localState.get('workflow') as WorkflowState;
    workflow.rankedEvents = events;
    workflow.updatedAt = new Date().toISOString();
    this.localState.set('workflow', workflow);

    void this.persistEvent('events_ranked', {
      rankedCount: events.length,
      topPicks: events.slice(0, 3).map((e) => ({ id: e.id, name: e.name })),
      workflowState: workflow,
    });
  }

  async storeItinerary(itinerary: Itinerary): Promise<void> {
    const workflow = this.localState.get('workflow') as WorkflowState;
    workflow.itinerary = itinerary;
    workflow.updatedAt = new Date().toISOString();
    this.localState.set('workflow', workflow);
    void this.persistEvent('itinerary_planned', { workflowState: workflow });
  }

  async storeBookingActions(actions: BookingAction[]): Promise<void> {
    const workflow = this.localState.get('workflow') as WorkflowState;
    workflow.bookingActions = actions;
    workflow.updatedAt = new Date().toISOString();
    this.localState.set('workflow', workflow);
    void this.persistEvent('bookings_executed', {
      actionCount: actions.length,
      workflowState: workflow,
    });
  }

  async storeUserIntent(intent: UserIntent): Promise<void> {
    const workflow = this.localState.get('workflow') as WorkflowState;
    workflow.userIntent = intent;
    workflow.updatedAt = new Date().toISOString();
    this.localState.set('workflow', workflow);
    void this.persistEvent('intent_parsed', { workflowState: workflow });
  }

  async addError(error: string): Promise<void> {
    const workflow = this.localState.get('workflow') as WorkflowState;
    workflow.errors = workflow.errors ?? [];
    workflow.errors.push(error);
    workflow.updatedAt = new Date().toISOString();
    this.localState.set('workflow', workflow);
    void this.persistEvent('workflow_error', { error, workflowState: workflow });
  }

  async setCustomData<T>(key: string, value: T): Promise<void> {
    this.localState.set(`custom:${key}`, value);
    void this.persistEvent('custom_data_set', { key, value });
  }

  async getWorkflowState(): Promise<WorkflowState | null> {
    return (this.localState.get('workflow') as WorkflowState) ?? null;
  }

  async getAgentStates(): Promise<Map<string, AgentStateUpdate>> {
    return (
      (this.localState.get('agents') as Map<string, AgentStateUpdate>) ??
      new Map()
    );
  }

  async getPhaseHistory(): Promise<WorkflowPhase[]> {
    return (this.localState.get('phases') as WorkflowPhase[]) ?? [];
  }

  async getCustomData<T>(key: string): Promise<T | null> {
    return (this.localState.get(`custom:${key}`) as T) ?? null;
  }

  getWorkflowId(): string | null {
    return this.workflowId;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Returns the Acontext session UUID for this run, or null if Acontext is unconfigured
   * or if session creation hasn't completed yet (it runs asynchronously).
   */
  getAcontextSessionId(): string | null {
    return this.acontextSessionId;
  }

  private async initAcontextSession(
    userId: string,
    initialState: WorkflowState,
  ): Promise<void> {
    if (!this.client || !this.workflowId) return;

    try {
      const session = await this.client.sessions.create({
        user: userId,
        configs: { workflowId: this.workflowId },
        // Disable auto-extraction: we publish structured trace events via TraceEventBus
        // and don't want Acontext parsing state snapshots as conversational tasks.
        disableTaskTracking: true,
      });

      this.acontextSessionId = session.id;
      console.log(
        `[context] Acontext session ${session.id} created for workflow ${this.workflowId}`,
      );

      await this.persistEvent('workflow_initialized', initialState);
    } catch (err) {
      console.warn(
        '[context] Acontext session creation failed — continuing in-memory only:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private async persistEvent(eventType: string, payload: unknown): Promise<void> {
    if (!this.client || !this.acontextSessionId) return;

    const workflow = this.localState.get('workflow') as WorkflowState | undefined;

    try {
      await this.client.sessions.storeMessage(
        this.acontextSessionId,
        { role: 'assistant', content: JSON.stringify(payload) },
        {
          format: 'openai',
          meta: {
            type: eventType,
            workflowId: this.workflowId,
            phase: workflow?.currentPhase ?? 'unknown',
            timestamp: new Date().toISOString(),
          },
        },
      );
    } catch (err) {
      console.warn(
        `[context] Acontext persist "${eventType}" failed — state preserved in-memory:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

export function createContextManager(config?: ContextConfig): ContextManager {
  return new ContextManager(config);
}
