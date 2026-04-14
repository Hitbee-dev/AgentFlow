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
import { chatViaCli } from '../provider/chat-cli.js';
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

  const systemPrompt = `${agentConfig.prompt}

When you have fully completed the task, end your final response with exactly: TASK COMPLETE`;

  const conversationHistory: ChatMessage[] = [
    { role: 'user', content: `Task: ${task.description}` },
  ];

  let turnCount = 0;
  let completed = false;
  let lastResponse = '';

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
      let rateLimitRetries = 0;
      while (rateLimitRetries <= 3) {
        try {
          for await (const chunk of chatViaCli(conversationHistory, {
            model: toModelID(agentConfig.model),
            system: systemPrompt,
            maxTokens: 4096,
          })) {
            if (chunk.type === 'text') {
              assistantResponse += chunk.text;
            }
          }
          break;
        } catch (err: unknown) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = err as any;
          const msg: string = e?.message ?? '';
          const isRateLimit =
            msg.includes('rate_limit') ||
            msg.includes('429') ||
            e?.name?.includes?.('RetryError') ||
            e?.reason === 'maxRetriesExceeded' ||
            msg.includes('Failed after');
          if (isRateLimit && rateLimitRetries < 3) {
            rateLimitRetries++;
            const waitMs = 30_000 * rateLimitRetries; // 30s, 60s, 90s
            console.log(`[agentflow-worker] Rate limit hit — waiting ${waitMs / 1000}s (attempt ${rateLimitRetries}/3)`);
            await Bun.sleep(waitMs);
          } else {
            throw err;
          }
        }
      }

      // d. Add assistant response to history
      if (assistantResponse) {
        conversationHistory.push({ role: 'assistant', content: assistantResponse });
      }

      // e. Update heartbeat (startHeartbeat timer handles this automatically)

      // f. Check if task is done
      if (assistantResponse.includes('TASK COMPLETE')) {
        completed = true;
        // Strip the completion signal from the saved result
        lastResponse = assistantResponse.replace(/\s*TASK COMPLETE\s*$/, '').trim();
      } else {
        lastResponse = assistantResponse;
      }
    }

    // 4. Update task state
    updateTask(task.id, { state: completed ? 'completed' : 'failed', result: lastResponse || undefined });
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
