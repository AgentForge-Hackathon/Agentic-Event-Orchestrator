import { StreamingText } from './StreamingText';

interface ReasoningBubbleProps {
  reasoning: string;
  confidence?: number;
  /** Set to false to skip word-by-word animation (e.g. replayed events) */
  animate?: boolean;
}

export function ReasoningBubble({ reasoning, confidence, animate = true }: ReasoningBubbleProps) {
  return (
    <div className="rounded-lg bg-muted border-l-2 border-primary p-3 mt-2">
      <p className="text-sm italic text-muted-foreground leading-relaxed">
        <StreamingText text={reasoning} animate={animate} speed={28} />
      </p>
      {confidence != null && (
        <span className="inline-block mt-1.5 text-xs font-medium text-primary">
          Confidence: {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}
