import { Agent } from '@mastra/core/agent';

import { EXECUTION_AGENT_SYSTEM_PROMPT } from './prompts.js';
import {
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
} from '../tools/execute-booking.js';

export const executionAgent = new Agent({
  id: 'executionAgent',
  name: 'Execution Agent',
  model: 'openai/gpt-4o-mini',
  tools: {
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
  instructions: EXECUTION_AGENT_SYSTEM_PROMPT,
});
