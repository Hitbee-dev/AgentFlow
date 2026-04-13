import { createTask, updateTask, listTasks } from '../agent/tasks.ts';
import { enqueue } from '../agent/dispatch.ts';
import { sendMessage } from '../agent/messaging.ts';
import { findBestAgent } from './distributor.ts';
import { resolveManualAgent } from './manual.ts';
import fs from 'fs';

const HISTORY_DIR = '.agent-cli/history';

export async function submitTask(description: string, targetAgentName?: string): Promise<string> {
  // 1. Create task record
  const task = createTask(description);

  // 2. Find agent (manual or auto)
  const agent = targetAgentName
    ? resolveManualAgent(targetAgentName)
    : await findBestAgent(description);

  if (!agent) {
    updateTask(task.id, { state: 'failed' });
    throw new Error('No available agent found for task');
  }

  // 3. Assign task
  updateTask(task.id, { state: 'assigned', assignedAgent: agent.name });

  // 4. Enqueue for dispatch
  enqueue(task.id, agent.name);

  // 5. Notify agent via messaging
  sendMessage(agent.name, 'orchestrator', 'task', `${task.id}:${description}`);

  return task.id;
}

export async function archiveCompletedTasks(): Promise<void> {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const completed = listTasks('completed');
  const failed = listTasks('failed');
  for (const task of [...completed, ...failed]) {
    const src = `.agent-cli/tasks/${task.id}.json`;
    const dst = `${HISTORY_DIR}/${task.id}.json`;
    if (fs.existsSync(src)) {
      fs.renameSync(src, dst);
    }
  }
}
