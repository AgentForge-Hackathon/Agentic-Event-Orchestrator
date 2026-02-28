import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import type { TraceEvent } from '@/types/trace';
import { Badge } from '@/components/ui/badge';
import { ReasoningBubble } from './ReasoningBubble';

import { StructuredReasoning } from './StructuredReasoning';
import { DecisionList } from './DecisionCard';

const TYPE_COLORS: Record<TraceEvent['type'], string> = {
  agent_run: 'border-l-primary',
  tool_call: 'border-l-green-500',
  workflow_run: 'border-l-purple-500',
  workflow_step: 'border-l-amber-500',
  workflow_parallel: 'border-l-cyan-500',
  model_generation: 'border-l-pink-500',
  model_step: 'border-l-gray-400',
  plan_approval: 'border-l-primary',
  booking_execution: 'border-l-blue-500',
  generic: 'border-l-gray-400',
};

const TYPE_LABELS: Record<TraceEvent['type'], string> = {
  agent_run: 'Agent',
  tool_call: 'Tool',
  workflow_run: 'Workflow',
  workflow_step: 'Step',
  workflow_parallel: 'Parallel',
  model_generation: 'LLM',
  model_step: 'Model',
  plan_approval: 'Approval',
  booking_execution: 'Booking',
  generic: 'Event',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusBadgeVariant(status: TraceEvent['status']) {
  switch (status) {
    case 'completed':
    case 'approved':
      return 'default' as const;
    case 'error':
    case 'rejected':
      return 'destructive' as const;
    case 'awaiting_approval':
      return 'outline' as const;
    default:
      return 'secondary' as const;
  }
}

interface SpanCardProps {
  event: TraceEvent;
  depth?: number;
  children?: React.ReactNode;
  /** Controlled expand state — driven by parent */
  expanded?: boolean;
  /** Callback when user manually toggles the details dropdown */
  onToggleExpand?: (eventId: string) => void;
}

export function SpanCard({ event, depth = 0, children, expanded = false, onToggleExpand }: SpanCardProps) {
  const [childrenVisible, setChildrenVisible] = useState(true);
  const hasChildren = !!children;
  const hasDetails =
    event.metadata?.inputSummary ||
    event.metadata?.outputSummary ||
    event.metadata?.eventCount != null ||
    event.metadata?.resultCount != null ||
    event.metadata?.model ||
    event.metadata?.tokenUsage ||
    event.metadata?.reasoning ||
    event.metadata?.reasoningSteps?.length ||
    event.metadata?.decisions?.length;

  return (
    <div style={{ marginLeft: depth > 0 ? `${depth * 20}px` : undefined }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`rounded-lg border bg-card text-card-foreground border-l-4 ${TYPE_COLORS[event.type]}`}
      >
        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {hasChildren && (
                <button
                  type="button"
                  onClick={() => setChildrenVisible(!childrenVisible)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-label={childrenVisible ? 'Collapse children' : 'Expand children'}
                >
                  {childrenVisible ? (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              )}
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
                {TYPE_LABELS[event.type]}
              </span>
              <span className="text-sm font-medium truncate">{event.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {event.durationMs != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {formatDuration(event.durationMs)}
                </span>
              )}
              <Badge variant={statusBadgeVariant(event.status)} className="text-xs capitalize">
                {event.status}
              </Badge>
            </div>
          </div>

          {hasDetails && (
            <button
              type="button"
              onClick={() => onToggleExpand?.(event.id)}
              className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          )}
        </div>

        {expanded && hasDetails && (
          <div className="px-3 pb-3 space-y-2 text-xs text-muted-foreground">
            {event.metadata?.inputSummary && (
              <div>
                <span className="font-medium text-foreground">Input: </span>
                {event.metadata.inputSummary}
              </div>
            )}
            {event.metadata?.outputSummary && (
              <div>
                <span className="font-medium text-foreground">Output: </span>
                {event.metadata.outputSummary}
              </div>
            )}
            {(event.metadata?.resultCount ?? event.metadata?.eventCount) != null && (
              <div>
                <span className="font-medium text-foreground">Results found: </span>
                {event.metadata?.resultCount ?? event.metadata?.eventCount}
              </div>
            )}
            {event.metadata?.model && (
              <div>
                <span className="font-medium text-foreground">Model: </span>
                {event.metadata.model}
              </div>
            )}
            {event.metadata?.tokenUsage && (
              <div>
                <span className="font-medium text-foreground">Tokens: </span>
                {event.metadata.tokenUsage.prompt} prompt + {event.metadata.tokenUsage.completion} completion = {event.metadata.tokenUsage.total} total
              </div>
            )}
            {event.metadata?.reasoning && (
              <ReasoningBubble
                reasoning={event.metadata.reasoning}
                confidence={event.metadata.confidence}
              />
            )}
            {event.metadata?.reasoningSteps && event.metadata.reasoningSteps.length > 0 && (
              <StructuredReasoning steps={event.metadata.reasoningSteps} />
            )}
            {event.metadata?.decisions && event.metadata.decisions.length > 0 && (
              <DecisionList decisions={event.metadata.decisions} />
            )}
          </div>
        )}
      </motion.div>

      {hasChildren && (
        <AnimatePresence>
          {childrenVisible && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mt-1.5 space-y-1.5 border-l-2 border-muted ml-2 pl-0"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
