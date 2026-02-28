import { Router } from 'express';
import type { Request, Response } from 'express';
import { traceEventBus } from '../../tracing/index.js';

const router = Router();

/**
 * GET /api/traces/stream/:workflowId
 *
 * Server-Sent Events endpoint that streams TraceEvents for a given workflow run.
 * The workflowId corresponds to the Mastra traceId set on the workflow run.
 *
 * - Replays historical events on connect (via TraceEventBus.subscribe)
 * - Streams new events as they arrive
 * - Sends heartbeat every 15s to keep connection alive
 * - Closes on client disconnect or workflow completion
 */
router.get(
  '/stream/:workflowId',
  (req: Request, res: Response): void => {
    const workflowId = req.params.workflowId as string;

    if (!workflowId) {
      res.status(400).json({ error: 'workflowId is required' });
      return;
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', workflowId })}\n\n`);

    // Subscribe to trace events (replays history + live events)
    const unsubscribe = traceEventBus.subscribe(workflowId, (event) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);

        // If the workflow_run span completed or errored, send done event
        if (
          event.type === 'workflow_run' &&
          (event.status === 'completed' || event.status === 'error')
        ) {
          res.write(`data: ${JSON.stringify({ type: 'done', workflowId })}\n\n`);
          // Don't end immediately — give the client a moment to process
          setTimeout(() => {
            res.end();
          }, 500);
        }
      } catch {
        // Connection closed, will be cleaned up below
      }
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 15_000);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  },
);

export { router as tracesRouter };
