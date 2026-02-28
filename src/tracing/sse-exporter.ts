/**
 * TraceEvent types re-exported from shared — single source of truth.
 * @see shared/types/trace.ts
 */
export type {
  ReasoningStep,
  Decision,
  TraceEvent,
  PipelineStep,
  TraceStreamStatus,
} from '@shared/types/trace.js';
// Local import for use within this file (export type re-exports don't create local bindings)
import type { TraceEvent } from '@shared/types/trace.js';

export type TraceEventListener = (event: TraceEvent) => void;

/**
 * In-memory pub/sub event bus for trace events, keyed by workflowId (traceId).
 *
 * - Subscribers receive all events for a given traceId.
 * - History is kept so late subscribers can replay past events.
 * - GC removes stale entries after TTL expires.
 */
export class TraceEventBus {
  /** Map of traceId → list of listener callbacks */
  private listeners = new Map<string, Set<TraceEventListener>>();

  /** Map of traceId → ordered history of events */
  private history = new Map<string, TraceEvent[]>();

  /** Map of traceId → creation timestamp (for GC) */
  private timestamps = new Map<string, number>();

  /** Time-to-live for history entries (default: 10 minutes) */
  private readonly ttlMs: number;

  /** GC interval handle */
  private gcInterval: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs = 10 * 60 * 1000) {
    this.ttlMs = ttlMs;
    // Run GC every 2 minutes
    this.gcInterval = setInterval(() => this.gc(), 2 * 60 * 1000);
  }

  /**
   * Emit a trace event. Stores in history and notifies all listeners for this traceId.
   */
  emit(event: TraceEvent): void {
    const { traceId } = event;

    // Store in history
    if (!this.history.has(traceId)) {
      this.history.set(traceId, []);
      this.timestamps.set(traceId, Date.now());
    }
    this.history.get(traceId)!.push(event);

    // Notify listeners
    const listeners = this.listeners.get(traceId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (err) {
          console.error('[trace-bus] Listener error:', err);
        }
      }
    }
  }

  /**
   * Subscribe to events for a given traceId.
   * Immediately replays any historical events, then receives new ones.
   * Returns an unsubscribe function.
   */
  subscribe(traceId: string, listener: TraceEventListener): () => void {
    if (!this.listeners.has(traceId)) {
      this.listeners.set(traceId, new Set());
    }
    this.listeners.get(traceId)!.add(listener);

    // Replay history
    const pastEvents = this.history.get(traceId);
    if (pastEvents) {
      for (const event of pastEvents) {
        try {
          listener(event);
        } catch (err) {
          console.error('[trace-bus] Replay listener error:', err);
        }
      }
    }

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(traceId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(traceId);
        }
      }
    };
  }

  /**
   * Get all historical events for a traceId.
   */
  getHistory(traceId: string): TraceEvent[] {
    return this.history.get(traceId) ?? [];
  }

  /**
   * Garbage collect stale entries beyond TTL.
   */
  private gc(): void {
    const now = Date.now();
    for (const [traceId, createdAt] of this.timestamps) {
      if (now - createdAt > this.ttlMs) {
        this.history.delete(traceId);
        this.timestamps.delete(traceId);
        this.listeners.delete(traceId);
      }
    }
  }

  /**
   * Shutdown the event bus and clear all state.
   */
  shutdown(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
    this.listeners.clear();
    this.history.clear();
    this.timestamps.clear();
  }
}

/** Singleton instance shared across the application */
export const traceEventBus = new TraceEventBus();
