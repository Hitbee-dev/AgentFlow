/**
 * Public API for the AgentFlow agent module.
 */

export { TmuxManager, tmuxManager } from './tmux-manager.js';

export {
  writeHeartbeat,
  readHeartbeat,
  isAlive,
  startHeartbeat,
  stopHeartbeat,
} from './heartbeat.js';

export type { MessageType, AgentMessage } from './messaging.js';
export { sendMessage, readMessages, clearMessages } from './messaging.js';

export type { BroadcastMessage } from './broadcast.js';
export { broadcast, readBroadcasts, updateOffset } from './broadcast.js';

export type { Task } from './tasks.js';
export {
  createTask,
  updateTask,
  getTask,
  listTasks,
  deleteTask,
} from './tasks.js';

export type { DispatchEntry } from './dispatch.js';
export { enqueue, dequeue, peekQueue } from './dispatch.js';

export {
  DEFAULT_AGENTS,
  getAgent,
  listAgents,
  registerAgent,
} from './registry.js';

export type { ExecutionContext } from './execution.js';
export { runAgent } from './execution.js';
