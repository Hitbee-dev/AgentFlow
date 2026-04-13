/**
 * Agent Execution Loop (skeleton) for AgentFlow
 *
 * Runs the main message loop for an agent against a task.
 * TODO: full tool-use loop — this is a skeleton.
 */

import { getAgent } from './registry.js';
import { writeHeartbeat, startHeartbeat, stopHeartbeat } from './heartbeat.js';
import { readMessages, clearMessages } from './messaging.js';
import { readBroadcasts } from './broadcast.js';
import { updateTask } from './tasks.js';
import { chat } from '../provider/chat.js';
import { toModelID } from '../provider/types.js';
import type { Task } from './tasks.js';
import type { ChatMessage } from '../provider/types.js';

export interface ExecutionContext {
  agentName: string;
  task: Task;
  maxTurns?: number;
}

/** Run the main execution loop for an agent on a given task. */
export async function runAgent(ctx: ExecutionContext): Promise<void> {
  const { agentName, task, maxTurns = 20 } = ctx;

  // 1. Load agent config from registry
  const agentConfig = getAgent(agentName);
  if (!agentConfig) {
    throw new Error(`Agent "${agentName}" not found in registry`);
  }

  // 2. Write initial heartbeat
  writeHeartbeat({
    agentName,
    status: 'running',
    timestamp: new Date().toISOString(),
    taskId: task.id,
  });

  const heartbeatTimer = startHeartbeat(agentName, 'running', task.id);

  // Update task to running state
  updateTask(task.id, { state: 'running', assignedAgent: agentName });

  const conversationHistory: ChatMessage[] = [
    { role: 'user', content: `Task: ${task.description}` },
  ];

  let turnCount = 0;
  let completed = false;

  try {
    // 3. Start message loop
    while (turnCount < maxTurns && !completed) {
      turnCount++;

      // a. Check for new messages in inbox
      const inboxMessages = readMessages(agentName);
      if (inboxMessages.length > 0) {
        clearMessages(agentName);
        for (const msg of inboxMessages) {
          conversationHistory.push({
            role: 'user',
            content: `[Message from ${msg.from}]: ${msg.content}`,
          });
        }
      }

      // b. Check for broadcasts
      const broadcasts = readBroadcasts(agentName);
      for (const bc of broadcasts) {
        conversationHistory.push({
          role: 'user',
          content: `[Broadcast from ${bc.from}]: ${bc.message}`,
        });
      }

      // c. Build messages array and stream response
      let assistantResponse = '';
      for await (const chunk of chat(conversationHistory, {
        model: toModelID(agentConfig.model),
        system: agentConfig.prompt,
      })) {
        if (chunk.type === 'text') {
          assistantResponse += chunk.text;
        }
      }

      // d. Add assistant response to history
      if (assistantResponse) {
        conversationHistory.push({ role: 'assistant', content: assistantResponse });
      }

      // e. Update heartbeat (startHeartbeat timer handles this automatically)

      // f. Check if task is done (simple heuristic: look for completion signals)
      const lowerResponse = assistantResponse.toLowerCase();
      if (
        lowerResponse.includes('task complete') ||
        lowerResponse.includes('task completed') ||
        lowerResponse.includes('done with the task')
      ) {
        completed = true;
      }
    }

    // 4. Update task state
    updateTask(task.id, { state: completed ? 'completed' : 'failed' });
  } catch (err) {
    updateTask(task.id, { state: 'failed' });
    throw err;
  } finally {
    // 5. Write final heartbeat and stop timer
    stopHeartbeat(heartbeatTimer);
    writeHeartbeat({
      agentName,
      status: 'idle',
      timestamp: new Date().toISOString(),
    });
  }
}
