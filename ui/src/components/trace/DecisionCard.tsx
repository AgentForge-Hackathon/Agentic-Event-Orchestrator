import { motion } from 'framer-motion';
import { ChevronDown, Clock } from 'lucide-react';
import { useState } from 'react';
import type { Decision } from '@/types/trace';

interface DecisionCardProps {
  decision: Decision;
  index?: number;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(score * 100)));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-medium text-primary tabular-nums">{pct}%</span>
    </div>
  );
}

export function DecisionCard({ decision, index = 0 }: DecisionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasData = decision.data && Object.keys(decision.data).length > 0;

  // Extract time from decision data (timeSlot or scheduledTimeSGT)
  const timeLabel = (() => {
    const d = decision.data as Record<string, unknown> | undefined;
    if (!d) return undefined;
    // Planning step provides pre-formatted SGT string
    if (typeof d.scheduledTimeSGT === 'string') return d.scheduledTimeSGT;
    // Discovery/recommendation steps provide raw timeSlot
    const ts = d.timeSlot as { start?: string; end?: string } | undefined;
    if (!ts?.start) return undefined;
    const fmt = (iso: string) => {
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) return undefined;
      // Convert to SGT (UTC+8)
      const sgt = new Date(dt.getTime() + 8 * 60 * 60 * 1000);
      const h = sgt.getUTCHours().toString().padStart(2, '0');
      const m = sgt.getUTCMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    };
    const start = fmt(ts.start);
    const end = ts.end ? fmt(ts.end) : undefined;
    if (!start) return undefined;
    return end ? `${start} – ${end}` : start;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.2, ease: 'easeOut' }}
      className="rounded-md border bg-card p-2.5 space-y-1.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground leading-tight">{decision.title}</span>
          {timeLabel && (
            <span className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              {timeLabel}
            </span>
          )}
        </div>
        {hasData && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide data' : 'Show data'}
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug">{decision.reason}</p>

      {decision.score != null && <ScoreBar score={decision.score} />}

      {expanded && hasData && (
        <pre className="text-[10px] text-muted-foreground bg-muted rounded p-2 overflow-x-auto max-h-32">
          {JSON.stringify(decision.data, null, 2)}
        </pre>
      )}
    </motion.div>
  );
}

interface DecisionListProps {
  decisions: Decision[];
}

export function DecisionList({ decisions }: DecisionListProps) {
  if (decisions.length === 0) return null;

  return (
    <div className="space-y-1.5 mt-2">
      <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
        Decisions
      </span>
      <div className="space-y-1.5">
        {decisions.map((d, i) => (
          <DecisionCard key={`${d.title}-${i}`} decision={d} index={i} />
        ))}
      </div>
    </div>
  );
}