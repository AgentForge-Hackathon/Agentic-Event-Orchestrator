import { AsyncLocalStorage } from 'node:async_hooks';

// Threads traceId through Mastra workflow steps via async context.
// Set in workflow.ts before run.start(), read in pipeline steps.
export const traceContext = new AsyncLocalStorage<string>();
