import { Agent } from '@mastra/core/agent';

import { PLANNING_AGENT_SYSTEM_PROMPT } from './prompts.js';

export const planningAgent = new Agent({
  id: 'planningAgent',
  name: 'Itinerary Planning Agent',
  model: 'openai/gpt-4o-mini',
  instructions: PLANNING_AGENT_SYSTEM_PROMPT,
});