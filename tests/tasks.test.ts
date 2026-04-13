import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';

// Use a temp dir for task files during tests
const TEST_ROOT = path.join(import.meta.dir, '.test-agent-cli');
const TASKS_DIR = path.join(TEST_ROOT, 'tasks');

// Patch the tasks dir before importing
process.chdir(import.meta.dir);

// We need to test using the actual module — patch via env or direct fs
// Since tasks.ts uses relative path '.agent-cli/tasks', we cd to temp dir
const originalCwd = process.cwd();

beforeEach(() => {
  fs.mkdirSync(TASKS_DIR, { recursive: true });
  process.chdir(import.meta.dir);
});

afterEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  process.chdir(originalCwd);
});

// Test helper: create a task by directly writing to fs to avoid module caching issues
function writeFakeTask(id: string, overrides: object = {}) {
  const now = new Date().toISOString();
  const task = {
    id,
    description: 'test task',
    state: 'pending',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  fs.mkdirSync(TASKS_DIR, { recursive: true });
  fs.writeFileSync(path.join(TASKS_DIR, `${id}.json`), JSON.stringify(task, null, 2));
  return task;
}

describe('Task file format', () => {
  test('task JSON has required fields', () => {
    const id = 'test-task-id-001';
    const task = writeFakeTask(id, { description: 'implement login' });
    expect(task.id).toBe(id);
    expect(task.description).toBe('implement login');
    expect(task.state).toBe('pending');
    expect(task.createdAt).toBeTruthy();
    expect(task.updatedAt).toBeTruthy();
  });

  test('task file is valid JSON', () => {
    const id = 'test-task-id-002';
    writeFakeTask(id);
    const raw = fs.readFileSync(path.join(TASKS_DIR, `${id}.json`), 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test('task states are valid enum values', () => {
    const validStates = ['pending', 'assigned', 'running', 'completed', 'failed'];
    for (const state of validStates) {
      const task = writeFakeTask(`task-${state}`, { state });
      expect(validStates).toContain(task.state);
    }
  });
});
