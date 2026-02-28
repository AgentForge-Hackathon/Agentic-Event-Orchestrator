import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { PlanFormDataSchema, type Itinerary } from '../../types/index.js';
import { mastra } from '../../mastra/index.js';
import { traceEventBus, traceContext } from '../../tracing/index.js';
import { createContextManager, contextRegistry } from '../../context/index.js';
import { resolveApproval, hasPendingApproval } from '../approval-registry.js';
import { persistItinerary } from '../persist-itinerary.js';
import { supabaseAdmin } from '../../../supabase/supabase.js';

const router = Router();

router.post(
  '/',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const parsed = PlanFormDataSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid form data',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const formData = parsed.data;

    try {
      console.log(
        `[workflow] Starting pipeline for user ${req.user?.id} — occasion: ${formData.occasion}, date: ${formData.date}`,
      );

      const workflow = mastra.getWorkflow('planningPipelineWorkflow');
      const run = await workflow.createRun();
      const workflowId = run.runId;

      const ctx = createContextManager();
      void ctx.initializeWorkflow(req.user!.id).catch(() => {});
      contextRegistry.set(workflowId, ctx);

      // Fetch user profile for execution agent (booking forms)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('name, phone_number, dietary_preferences, special_requests')
        .eq('id', req.user!.id)
        .single();
      if (profile) {
        void ctx.setCustomData('userProfile', {
          name: profile.name ?? 'Guest',
          email: req.user!.email,
          phone: profile.phone_number ?? '',
          dietaryPreferences: profile.dietary_preferences ?? [],
          specialRequests: profile.special_requests ?? '',
        }).catch(() => {});
      }

      res.json({
        workflowId,
        phase: 'started',
      });

      traceContext.run(workflowId, () => {
        run
          .start({
            inputData: { formData, userQuery: '' },
          })
          .then((result: { status: string; result?: unknown; steps?: unknown }) => {
            if (result.status === 'success') {
              const resultData = result.result as { events?: unknown[]; rankedEvents?: { event: unknown; score: number; reasoning: string }[] };
              const events = resultData?.events ?? [];
              const rankedEvents = resultData?.rankedEvents ?? [];
              const topCount = rankedEvents.length > 0 ? rankedEvents.length : events.length;
              console.log(
                `[workflow] ✅ Pipeline success — ${topCount} top picks from ${events.length} events (run: ${workflowId})`,
              );
              setTimeout(() => contextRegistry.delete(workflowId), 5 * 60 * 1000);

              traceEventBus.emit({
                id: `${workflowId}-result`,
                traceId: workflowId,
                type: 'workflow_run',
                name: 'pipeline-result',
                status: 'completed',
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                durationMs: 0,
                metadata: {
                  outputSummary: `${topCount} top picks selected`,
                  eventCount: topCount,
                  pipelineStep: 'recommendation',
                },
              });
            } else {
              console.error(
                `[workflow] ❌ Pipeline failed (run: ${workflowId})`,
                result.steps,
              );

              traceEventBus.emit({
                id: `${workflowId}-error`,
                traceId: workflowId,
                type: 'workflow_run',
                name: 'pipeline-error',
                status: 'error',
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                error: 'Workflow did not complete successfully',
              });
              void ctx.addError('Pipeline did not complete successfully').catch(() => {});
              setTimeout(() => contextRegistry.delete(workflowId), 5 * 60 * 1000);
            }
          })
          .catch((error: unknown) => {
            console.error('[workflow] Pipeline error:', error);
            const errMsg = error instanceof Error ? error.message : 'Unknown pipeline error';
            void ctx.addError(errMsg).catch(() => {});
            setTimeout(() => contextRegistry.delete(workflowId), 5 * 60 * 1000);

            traceEventBus.emit({
              id: `${workflowId}-error`,
              traceId: workflowId,
              type: 'workflow_run',
              name: 'pipeline-error',
              status: 'error',
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              error:
                error instanceof Error ? error.message : 'Unknown pipeline error',
            });
          });
      });
    } catch (error) {
      console.error('Workflow error:', error);
      res.status(500).json({
        error: 'Failed to start planning pipeline',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// ── Plan Approval Endpoint ──
router.post(
  '/:workflowId/approve',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const rawId = req.params.workflowId;
    const workflowId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { approved } = req.body as { approved?: boolean };

    if (!workflowId) {
      res.status(400).json({ error: 'Missing workflowId parameter' });
      return;
    }

    if (typeof approved !== 'boolean') {
      res.status(400).json({ error: 'Missing required field: approved (boolean)' });
      return;
    }

    if (!hasPendingApproval(workflowId)) {
      res.status(404).json({ error: 'No pending approval for this workflow' });
      return;
    }

    const resolved = resolveApproval(workflowId, approved);
    if (!resolved) {
      res.status(409).json({ error: 'Approval already resolved' });
      return;
    }

    console.log(`[workflow] Plan ${approved ? 'approved ✅' : 'rejected ❌'} for workflow ${workflowId}`);

    // If approved, persist the itinerary to the database
    if (approved) {
      try {
        const ctx = contextRegistry.get(workflowId);
        const workflowState = await ctx?.getWorkflowState();
        const itinerary = workflowState?.itinerary as Itinerary | undefined;

        if (itinerary && req.user?.id) {
          const { itineraryId, itemCount } = await persistItinerary(req.user.id, itinerary);
          res.json({ workflowId, approved, itineraryId, itemCount });
          return;
        }

        // Itinerary not yet in context — approval resolved but no DB persist
        console.warn(`[workflow] Approved but no itinerary in context for ${workflowId}`);
        res.json({ workflowId, approved, warning: 'Itinerary not found in context' });
      } catch (err) {
        console.error(`[workflow] Failed to persist itinerary for ${workflowId}:`, err);
        // Approval still succeeded (pipeline unblocked) even if DB write failed
        res.json({
          workflowId,
          approved,
          warning: `Itinerary persistence failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    } else {
      res.json({ workflowId, approved });
    }
  },
);

export { router as workflowRouter };
