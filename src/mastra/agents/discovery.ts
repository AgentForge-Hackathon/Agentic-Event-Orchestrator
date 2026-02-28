import { Agent } from '@mastra/core/agent';

import { DISCOVERY_AGENT_SYSTEM_PROMPT } from './prompts.js';
import { searchEventbriteTool } from '../tools/search-eventbrite.js';
import { searchEventfindaTool } from '../tools/search-eventfinda.js';
import { deduplicateEventsTool } from '../tools/deduplicate-events.js';

export const discoveryAgent = new Agent({
  id: 'discoveryAgent',
  name: 'Event Discovery Agent',
  model: 'openai/gpt-4o-mini',
  tools: {
    searchEventbriteTool,
    searchEventfindaTool,
    deduplicateEventsTool,
  },
  instructions: DISCOVERY_AGENT_SYSTEM_PROMPT,
});
