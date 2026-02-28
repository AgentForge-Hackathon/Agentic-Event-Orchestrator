import { motion } from 'framer-motion';
import {
  MapPin,
  Clock,
  DollarSign,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { TraceEvent } from '@/types/trace';

type ApprovalData = NonNullable<NonNullable<TraceEvent['metadata']>['approvalData']>;

interface PlanApprovalCardProps {
  approvalData: ApprovalData;
  onApprove: () => void;
  onReject: () => void;
  /** Whether the approve/reject action is in flight */
  submitting?: boolean;
  /** Set after approval decision is made */
  decision?: 'approved' | 'rejected' | null;
}

/** Format an ISO datetime string to HH:MM in Singapore Time (UTC+8) */
function formatSGT(isoString: string): string {
  const d = new Date(isoString);
  const sgtMs = d.getTime() + 8 * 60 * 60 * 1000;
  const sgt = new Date(sgtMs);
  const h = sgt.getUTCHours().toString().padStart(2, '0');
  const m = sgt.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatPrice(price: { min: number; max: number; currency: string }): string {
  if (price.min === 0 && price.max === 0) return 'Free';
  if (price.min === price.max) return `$${price.min}`;
  return `$${price.min}–${price.max}`;
}

export function PlanApprovalCard({
  approvalData,
  onApprove,
  onReject,
  submitting = false,
  decision = null,
}: PlanApprovalCardProps) {
  const { itinerary, planMetadata, occasion } = approvalData;

  const sortedItems = [...itinerary.items].sort(
    (a, b) => new Date(a.scheduledTime.start).getTime() - new Date(b.scheduledTime.start).getTime(),
  );

  const isResolved = decision !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          {planMetadata.itineraryName}
        </h2>
        {planMetadata.overallVibe && (
          <p className="text-sm text-muted-foreground italic">
            {planMetadata.overallVibe}
          </p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="flex flex-wrap justify-center gap-2">
        <Badge variant="secondary" className="gap-1 text-xs">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {occasion.replace(/_/g, ' ')}
        </Badge>
        <Badge variant="secondary" className="gap-1 text-xs">
          <DollarSign className="h-3 w-3" aria-hidden="true" />
          ~${planMetadata.totalEstimatedCostPerPerson}/person
        </Badge>
      </div>

      <Separator />

      {/* Timeline */}
      <div className="space-y-2">
        {sortedItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + index * 0.08, duration: 0.25 }}
          >
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {item.event.name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
                      <span className="text-xs text-muted-foreground">
                        {formatSGT(item.scheduledTime.start)} – {formatSGT(item.scheduledTime.end)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {item.event.category}
                    </Badge>
                    {item.event.price && (
                      <span className="text-xs text-muted-foreground">
                        {formatPrice(item.event.price)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground truncate">
                    {item.event.location.name}
                    {item.event.location.address && ` · ${item.event.location.address}`}
                  </span>
                </div>

                {item.notes && (
                  <p className="text-xs text-muted-foreground italic">
                    {item.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Separator />

      {/* Action Buttons */}
      {!isResolved ? (
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={onReject}
            disabled={submitting}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Reject
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={onApprove}
            disabled={submitting}
          >
            {submitting ? (
              <>Submitting…</>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Approve Plan
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex justify-center">
          <Badge
            variant={decision === 'approved' ? 'default' : 'destructive'}
            className="text-sm py-1.5 px-4"
          >
            {decision === 'approved' ? '✓ Plan Approved' : '✗ Plan Rejected'}
          </Badge>
        </div>
      )}
    </motion.div>
  );
}
