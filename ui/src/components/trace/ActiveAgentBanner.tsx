import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Search,
  Star,
  Calendar,
  Rocket,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type { TraceEvent, PipelineStep } from '@/types/trace';
import { StreamingText } from './StreamingText';

const AGENT_CONFIG: Record<
  PipelineStep,
  { name: string; icon: typeof Brain; gradient: string }
> = {
  intent: {
    name: 'Understanding your preferences',
    icon: Brain,
    gradient: 'from-violet-500/20 to-violet-500/5',
  },
  discovery: {
    name: 'Searching for events',
    icon: Search,
    gradient: 'from-blue-500/20 to-blue-500/5',
  },
  recommendation: {
    name: 'Curating the best matches',
    icon: Star,
    gradient: 'from-amber-500/20 to-amber-500/5',
  },
  planning: {
    name: 'Building your itinerary',
    icon: Calendar,
    gradient: 'from-emerald-500/20 to-emerald-500/5',
  },
  execution: {
    name: 'Making your bookings',
    icon: Rocket,
    gradient: 'from-rose-500/20 to-rose-500/5',
  },
};

interface ActiveAgent {
  step: PipelineStep;
  name: string;
  status: string;
}

/**
 * Derives the currently active agent from trace events.
 *
 * NOTE: Currently returns 'done' when all emitted pipeline steps have completed.
 * Since only intent and discovery emit traces today, the banner shows 'All agents complete'
 * after discovery finishes — even though recommendation/planning/execution haven't run.
 * Update this logic when more pipeline steps are wired.
 */
function deriveActiveAgent(events: TraceEvent[]): ActiveAgent | 'done' | null {
  let latestRunning: ActiveAgent | null = null;
  let latestCompleted: ActiveAgent | null = null;
  let hasAnyEvent = false;

  for (const event of events) {
    const step = event.metadata?.pipelineStep;
    if (!step) continue;
    hasAnyEvent = true;

    const agentName =
      event.metadata?.agentName ?? AGENT_CONFIG[step]?.name ?? step;
    const agentStatus = event.metadata?.agentStatus ?? '';

    if (event.status === 'started' || event.status === 'running') {
      latestRunning = { step, name: agentName, status: agentStatus };
    }
    if (event.status === 'completed') {
      latestCompleted = { step, name: agentName, status: agentStatus };
    }
  }


  if (latestRunning) return latestRunning;


  if (hasAnyEvent) {
    if (latestCompleted) {
      return 'done';
    }
  }

  return null;
}

interface ActiveAgentBannerProps {
  events: TraceEvent[];
}

export function ActiveAgentBanner({ events }: ActiveAgentBannerProps) {
  const activeAgent = useMemo(() => deriveActiveAgent(events), [events]);


  if (activeAgent === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
      >
        <Loader2
          className="h-5 w-5 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-muted-foreground">
            Getting started…
          </span>
        </div>
      </motion.div>
    );
  }


  if (activeAgent === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <CheckCircle2
            className="h-5 w-5 text-green-500"
            aria-hidden="true"
          />
        </motion.div>
        <span className="text-sm font-medium text-green-600 dark:text-green-400">
          Your plan is ready!
        </span>
      </motion.div>
    );
  }


  const config = AGENT_CONFIG[activeAgent.step];
  const Icon = config.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeAgent.step}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`relative flex items-center gap-3 rounded-lg border bg-gradient-to-r ${config.gradient} px-4 py-3 overflow-hidden`}
      >

        <div className="relative shrink-0">
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/20 blur-md"
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="relative flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-card"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          </motion.div>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground">
            {activeAgent.name}
          </span>
          {activeAgent.status && (
            <span className="text-xs text-muted-foreground truncate">
              <StreamingText
                text={activeAgent.status}
                speed={20}
                animate={true}
              />
            </span>
          )}
        </div>


        <motion.div
          className="absolute inset-0 rounded-lg border border-primary/20"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
