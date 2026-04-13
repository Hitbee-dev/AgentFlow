/**
 * Integration test: full task lifecycle
 *
 * Tests the flow: create task → enqueue → dequeue → state transitions
 * without requiring live agents or LLM credentials.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';

const TEST_DIR = path.join(import.meta.dir, '.test-lifecycle');

// Simulate the full task pipeline using fs directly
// (avoids cwd dependency of the production modules)

interface Task {
  id: string;
  description: string;
  state: string;
  assignedAgent?: string;
  createdAt: string;
  updatedAt: string;
}

interface DispatchEntry {
  taskId: string;
  targetAgent?: string;
}

function setupDirs() {
  for (const dir of ['tasks', 'queue', 'heartbeat']) {
    fs.mkdirSync(path.join(TEST_DIR, dir), { recursive: true });
  }
}

function createTask(id: string, description: string): Task {
  const now = new Date().toISOString();
  const task: Task = { id, description, state: 'pending', createdAt: now, updatedAt: now };
  fs.writeFileSync(path.join(TEST_DIR, 'tasks', `${id}.json`), JSON.stringify(task));
  return task;
}

function updateTask(id: string, updates: Partial<Task>): Task {
  const task = JSON.parse(fs.readFileSync(path.join(TEST_DIR, 'tasks', `${id}.json`), 'utf-8')) as Task;
  const updated = { ...task, ...updates, id: task.id, updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(TEST_DIR, 'tasks', `${id}.json`), JSON.stringify(updated));
  return updated;
}

function getTask(id: string): Task | null {
  const p = path.join(TEST_DIR, 'tasks', `${id}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as Task;
}

function enqueue(taskId: string, targetAgent?: string): void {
  const entry: DispatchEntry = { taskId, ...(targetAgent ? { targetAgent } : {}) };
  fs.appendFileSync(path.join(TEST_DIR, 'queue', 'dispatch.jsonl'), JSON.stringify(entry) + '\n');
}

function dequeue(): DispatchEntry | null {
  const file = path.join(TEST_DIR, 'queue', 'dispatch.jsonl');
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  if (!lines.length) return null;
  const [first, ...rest] = lines;
  fs.writeFileSync(file, rest.join('\n') + (rest.length ? '\n' : ''));
  return JSON.parse(first!) as DispatchEntry;
}

beforeEach(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  setupDirs();
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Task lifecycle', () => {
  test('task created with pending state', () => {
    const task = createTask('task-001', 'implement dark mode');
    expect(task.state).toBe('pending');
    expect(task.id).toBe('task-001');
  });

  test('task transitions: pending → assigned → running → completed', () => {
    createTask('task-002', 'write tests');
    updateTask('task-002', { state: 'assigned', assignedAgent: 'coder' });
    expect(getTask('task-002')?.state).toBe('assigned');
    expect(getTask('task-002')?.assignedAgent).toBe('coder');

    updateTask('task-002', { state: 'running' });
    expect(getTask('task-002')?.state).toBe('running');

    updateTask('task-002', { state: 'completed' });
    expect(getTask('task-002')?.state).toBe('completed');
  });

  test('task enqueued after assignment', () => {
    createTask('task-003', 'review PR');
    enqueue('task-003', 'reviewer');
    const entry = dequeue();
    expect(entry?.taskId).toBe('task-003');
    expect(entry?.targetAgent).toBe('reviewer');
  });

  test('multiple tasks processed in FIFO order', () => {
    const ids = ['task-a', 'task-b', 'task-c'];
    for (const id of ids) {
      createTask(id, `task ${id}`);
      enqueue(id);
    }
    for (const id of ids) {
      const entry = dequeue();
      expect(entry?.taskId).toBe(id);
    }
  });

  test('failed task preserves description', () => {
    createTask('task-004', 'deploy to prod');
    updateTask('task-004', { state: 'failed' });
    const task = getTask('task-004');
    expect(task?.state).toBe('failed');
    expect(task?.description).toBe('deploy to prod');
  });
});

describe('Task classifier integration', () => {
  test('classifyTask routes to correct agent role', async () => {
    const { classifyTask } = await import('../src/orchestrator/distributor.ts');
    expect(classifyTask('implement login page')).toBe('code');
    expect(classifyTask('review the auth PR')).toBe('review');
    expect(classifyTask('plan the new dashboard')).toBe('plan');
    expect(classifyTask('test the payment flow')).toBe('test');
    expect(classifyTask('security audit the API')).toBe('security');
  });
});
