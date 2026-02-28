import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ReasoningStep } from '@/types/trace';

const STATUS_CONFIG: Record<NonNullable<ReasoningStep['status']>, { icon: typeof Info; color: string }> = {
  pass: { icon: CheckCircle2, color: 'text-green-500' },
  fail: { icon: XCircle, color: 'text-destructive' },
  info: { icon: Info, color: 'text-primary' },
};

interface StructuredReasoningProps {
  steps: ReasoningStep[];
}

export function StructuredReasoning({ steps }: StructuredReasoningProps) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-1.5 mt-2">
      <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
        Reasoning
      </span>
      <ul className="space-y-1" role="list">
        {steps.map((step, i) => {
          const status = step.status ?? 'info';
          const { icon: Icon, color } = STATUS_CONFIG[status];
          return (
            <motion.li
              key={`${step.label}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.2, ease: 'easeOut' }}
              className="flex items-start gap-2 text-xs"
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`}
                aria-label={status}
              />
              <span>
                <span className="font-medium text-foreground">{step.label}: </span>
                <span className="text-muted-foreground">{step.detail}</span>
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}