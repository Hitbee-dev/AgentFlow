#!/usr/bin/env bun
/**
 * AgentFlow Agent Worker
 *
 * This process runs inside a tmux session for a specific agent.
 * Usage: agentflow agent-worker <agentName>
 *
 * It polls the dispatch queue for tasks assigned to this agent,
 * then runs the execution loop for each task.
 */

import { getAgent } from '../agent/registry.ts';
import { writeHeartbeat, startHeartbeat, stopHeartbeat } from '../agent/heartbeat.ts';
import { dequeue } from '../agent/dispatch.ts';
import { getTask } from '../agent/tasks.ts';
import { runAgent } from '../agent/execution.ts';

const agentName = process.argv[2];
if (!agentName) {
  console.error('Usage: agentflow agent-worker <agentName>');
  process.exit(1);
}

const agent = getAgent(agentName);
if (!agent) {
  console.error(`Agent "${agentName}" not found in registry`);
  process.exit(1);
}

console.log(`[agentflow-worker] Starting agent: ${agentName} (${agent.model})`);

// Write initial idle heartbeat
writeHeartbeat({ agentName, status: 'idle', timestamp: new Date().toISOString() });
const heartbeatTimer = startHeartbeat(agentName, 'idle');

// Poll loop: check dispatch queue every 2 seconds
async function pollLoop(): Promise<void> {
  while (true) {
    try {
      const entry = dequeue();
      if (entry && (entry.targetAgent === agentName || !entry.targetAgent)) {
        const task = getTask(entry.taskId);
        if (task) {
          console.log(`[agentflow-worker] Running task ${task.id}: ${task.description}`);
          stopHeartbeat(heartbeatTimer);
          await runAgent({ agentName, task });
          // Resume idle heartbeat after task
          startHeartbeat(agentName, 'idle');
          console.log(`[agentflow-worker] Task ${task.id} complete`);
        }
      }
    } catch (err) {
      console.error(`[agentflow-worker] Error:`, err);
    }
    await Bun.sleep(2000);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log(`[agentflow-worker] Shutting down ${agentName}`);
  stopHeartbeat(heartbeatTimer);
  writeHeartbeat({ agentName, status: 'stopped', timestamp: new Date().toISOString() });
  process.exit(0);
});

process.on('SIGINT', () => {
  stopHeartbeat(heartbeatTimer);
  writeHeartbeat({ agentName, status: 'stopped', timestamp: new Date().toISOString() });
  process.exit(0);
});

pollLoop().catch(err => {
  console.error('[agentflow-worker] Fatal:', err);
  stopHeartbeat(heartbeatTimer);
  process.exit(1);
});
