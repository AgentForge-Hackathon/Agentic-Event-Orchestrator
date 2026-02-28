/**
 * In-memory approval registry for workflow plan approval gates.
 *
 * When the pipeline reaches the approval step, it calls `waitForApproval(workflowId)`
 * which returns a Promise that resolves when the user POSTs to /api/workflow/:id/approve.
 *
 * Entries are auto-cleaned after 30 minutes to prevent memory leaks.
 */

interface PendingApproval {
  resolve: (approved: boolean) => void;
  createdAt: number;
}

const pendingApprovals = new Map<string, PendingApproval>();

/** TTL for pending approvals (30 minutes) */
const APPROVAL_TTL_MS = 30 * 60 * 1000;

/**
 * Called by the pipeline when it reaches the approval gate.
 * Returns a Promise that resolves to `true` (approved) or `false` (rejected)
 * when the user submits their decision.
 */
export function waitForApproval(workflowId: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    pendingApprovals.set(workflowId, { resolve, createdAt: Date.now() });
  });
}

/**
 * Called by the API route when the user submits an approval decision.
 * Returns true if a pending approval was found and resolved, false otherwise.
 */
export function resolveApproval(workflowId: string, approved: boolean): boolean {
  const pending = pendingApprovals.get(workflowId);
  if (!pending) return false;

  pending.resolve(approved);
  pendingApprovals.delete(workflowId);
  return true;
}

/**
 * Check if a workflow has a pending approval.
 */
export function hasPendingApproval(workflowId: string): boolean {
  return pendingApprovals.has(workflowId);
}

// GC: clean up stale approvals every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of pendingApprovals) {
    if (now - entry.createdAt > APPROVAL_TTL_MS) {
      // Resolve as rejected (timed out)
      entry.resolve(false);
      pendingApprovals.delete(id);
    }
  }
}, 5 * 60 * 1000);
