import 'dotenv/config';

import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';

import { SSETracingExporter } from '../tracing/index.js';

import {
  intentAgent,
  discoveryAgent,
  recommendationAgent,
  planningAgent,
  executionAgent,
} from './agents/index.js';

import {
  parseIntentTool,
  searchEventbriteTool,
  searchEventfindaTool,
  deduplicateEventsTool,
  rankEventsTool,
  planItineraryTool,
  executeBookingTool,
  browserOpenTool,
  browserSnapshotTool,
  browserClickTool,
  browserFillTool,
  browserSelectTool,
  browserPressTool,
  browserWaitTool,
  browserScreenshotTool,
  browserTextTool,
  browserEvalTool,
  browserCloseTool,
} from './tools/index.js';

import { planningPipelineWorkflow } from './workflows/planning-pipeline.js';

export const mastra = new Mastra({
  agents: {
    intentAgent,
    discoveryAgent,
    recommendationAgent,
    planningAgent,
    executionAgent,
  },
  tools: {
    parseIntentTool,
    searchEventbriteTool,
    searchEventfindaTool,
    deduplicateEventsTool,
    rankEventsTool,
    planItineraryTool,
    executeBookingTool,
    browserOpenTool,
    browserSnapshotTool,
    browserClickTool,
    browserFillTool,
    browserSelectTool,
    browserPressTool,
    browserWaitTool,
    browserScreenshotTool,
    browserTextTool,
    browserEvalTool,
    browserCloseTool,
  },
  workflows: {
    planningPipelineWorkflow,
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'itinerary-planner',
        exporters: [new SSETracingExporter()],
      },
    },
  }),
});
