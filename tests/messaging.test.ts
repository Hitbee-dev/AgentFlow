/**
 * Tests for inter-agent messaging and heartbeat systems
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';

const TEST_DIR = path.join(import.meta.dir, '.test-messaging');
const ORIG_CWD = process.cwd();

beforeEach(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  // Create required subdirectories
  for (const d of ['.agent-cli/messages', '.agent-cli/state']) {
    fs.mkdirSync(path.join(TEST_DIR, d), { recursive: true });
  }
  process.chdir(TEST_DIR);
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Messaging', () => {
  test('sendMessage creates inbox file', async () => {
    const { sendMessage, readMessages } = await import('../src/agent/messaging.ts');
    sendMessage('coder', 'orchestrator', 'task', 'implement login');
    const messages = readMessages('coder');
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe('implement login');
    expect(messages[0]!.from).toBe('orchestrator');
    expect(messages[0]!.to).toBe('coder');
    expect(messages[0]!.type).toBe('task');
  });

  test('clearMessages empties inbox', async () => {
    const { sendMessage, readMessages, clearMessages } = await import('../src/agent/messaging.ts');
    sendMessage('coder', 'user', 'info', 'hello');
    sendMessage('coder', 'user', 'info', 'world');
    expect(readMessages('coder')).toHaveLength(2);
    clearMessages('coder');
    expect(readMessages('coder')).toHaveLength(0);
  });

  test('multiple agents have separate inboxes', async () => {
    const { sendMessage, readMessages } = await import('../src/agent/messaging.ts');
    sendMessage('coder', 'user', 'task', 'for coder');
    sendMessage('planner', 'user', 'task', 'for planner');
    expect(readMessages('coder')).toHaveLength(1);
    expect(readMessages('planner')).toHaveLength(1);
    expect(readMessages('reviewer')).toHaveLength(0);
  });

  test('message has required fields', async () => {
    const { sendMessage, readMessages } = await import('../src/agent/messaging.ts');
    sendMessage('qa', 'security', 'result', 'all tests pass');
    const [msg] = readMessages('qa');
    expect(msg!.id).toBeTruthy();
    expect(msg!.timestamp).toBeTruthy();
    expect(typeof msg!.id).toBe('string');
  });

  test('readMessages returns empty array for non-existent inbox', async () => {
    const { readMessages } = await import('../src/agent/messaging.ts');
    expect(readMessages('nobody')).toHaveLength(0);
  });
});

describe('Heartbeat', () => {
  test('writeHeartbeat creates heartbeat file', async () => {
    const { writeHeartbeat, readHeartbeat } = await import('../src/agent/heartbeat.ts');
    writeHeartbeat({ agentName: 'coder', status: 'idle', timestamp: new Date().toISOString() });
    const hb = readHeartbeat('coder');
    expect(hb).not.toBeNull();
    expect(hb!.agentName).toBe('coder');
    expect(hb!.status).toBe('idle');
  });

  test('isAlive returns true for fresh heartbeat', async () => {
    const { writeHeartbeat, isAlive } = await import('../src/agent/heartbeat.ts');
    writeHeartbeat({ agentName: 'planner', status: 'running', timestamp: new Date().toISOString() });
    expect(isAlive('planner')).toBe(true);
  });

  test('isAlive returns false for stale heartbeat', async () => {
    const { writeHeartbeat, isAlive } = await import('../src/agent/heartbeat.ts');
    const staleTime = new Date(Date.now() - 60_000).toISOString();
    writeHeartbeat({ agentName: 'reviewer', status: 'idle', timestamp: staleTime });
    expect(isAlive('reviewer', 30_000)).toBe(false);
  });

  test('isAlive returns false for non-existent agent', async () => {
    const { isAlive } = await import('../src/agent/heartbeat.ts');
    expect(isAlive('ghost-agent')).toBe(false);
  });

  test('heartbeat with taskId preserved', async () => {
    const { writeHeartbeat, readHeartbeat } = await import('../src/agent/heartbeat.ts');
    writeHeartbeat({ agentName: 'coder', status: 'running', timestamp: new Date().toISOString(), taskId: 'task-abc' });
    const hb = readHeartbeat('coder');
    expect(hb!.taskId).toBe('task-abc');
  });
});
