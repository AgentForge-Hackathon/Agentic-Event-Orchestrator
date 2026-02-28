import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  type PlanFormData,
  type UserConstraints,
  type UserIntent,
  UserConstraintsSchema,
  mapPlanFormToConstraints,
  PlanFormDataSchema,
} from '../../types/index.js';

/**
 * Parse Intent Tool
 *
 * Takes structured form data from the plan wizard and maps it to domain constraints.
 * The Intent Agent's LLM enriches this with category preferences and reasoning.
 *
 * Note: The heavy lifting (LLM enrichment, category inference) happens in the agent
 * itself via its system prompt. This tool handles the deterministic form → constraints mapping.
 */
export const parseIntentTool = createTool({
  id: 'parse-intent',
  description:
    'Parses structured plan form data into user constraints. Maps occasion, budget, party size, date, time, duration, and areas into domain-specific constraints for the planning pipeline.',
  inputSchema: z.object({
    formData: PlanFormDataSchema,
    userQuery: z.string().optional().default(''),
  }),
  outputSchema: z.object({
    intentType: z.enum([
      'plan_date',
      'plan_trip',
      'find_events',
      'book_specific',
      'modify_plan',
    ]),
    constraints: z.record(z.any()),
    naturalLanguageSummary: z.string(),
    formData: z.record(z.any()),
  }),
  execute: async (inputData) => {
    const { formData, userQuery } = inputData;

    const mapped = mapPlanFormToConstraints(formData);

    return {
      intentType: mapped.intentType,
      constraints: mapped.constraints as Record<string, unknown>,
      naturalLanguageSummary: mapped.naturalLanguageSummary,
      formData: formData as unknown as Record<string, unknown>,
    };
  },
});
