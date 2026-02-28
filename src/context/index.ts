export type {
  AgentStateUpdate,
  ContextConfig,
  WorkflowPhase,
} from './context-manager.js';
export { ContextManager, createContextManager } from './context-manager.js';

import type { ContextManager } from './context-manager.js';

export const contextRegistry = new Map<string, ContextManager>();
