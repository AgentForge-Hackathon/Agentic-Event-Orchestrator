import { Agent } from '@mastra/core/agent';

import { INTENT_AGENT_SYSTEM_PROMPT } from './prompts.js';
import { parseIntentTool } from '../tools/parse-intent.js';

export const intentAgent = new Agent({
  id: 'intentAgent',
  name: 'Intent Understanding Agent',
  model: 'openai/gpt-4o-mini',
  tools: { parseIntentTool },
  instructions: INTENT_AGENT_SYSTEM_PROMPT,
});
