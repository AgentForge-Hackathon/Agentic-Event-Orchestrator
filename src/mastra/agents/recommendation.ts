import { Agent } from '@mastra/core/agent';

import { RECOMMENDATION_AGENT_SYSTEM_PROMPT } from './prompts.js';

export const recommendationAgent = new Agent({
  id: 'recommendationAgent',
  name: 'Recommendation Agent',
  model: 'openai/gpt-4o-mini',
  instructions: RECOMMENDATION_AGENT_SYSTEM_PROMPT,
});
