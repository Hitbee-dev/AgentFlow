import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';

const TEST_DIR = path.join(import.meta.dir, '.test-dispatch');
const DISPATCH_FILE = path.join(TEST_DIR, 'queue', 'dispatch.jsonl');

function ensureDir() {
  fs.mkdirSync(path.dirname(DISPATCH_FILE), { recursive: true });
}

function writeEntries(entries: object[]) {
  ensureDir();
  fs.writeFileSync(DISPATCH_FILE, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

function readEntries(): object[] {
  if (!fs.existsSync(DISPATCH_FILE)) return [];
  return fs.readFileSync(DISPATCH_FILE, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l));
}

function appendEntry(entry: object) {
  ensureDir();
  fs.appendFileSync(DISPATCH_FILE, JSON.stringify(entry) + '\n');
}

function dequeue(): object | null {
  const entries = readEntries();
  if (!entries.length) return null;
  const [first, ...rest] = entries;
  ensureDir();
  fs.writeFileSync(DISPATCH_FILE, rest.map(e => JSON.stringify(e)).join('\n') + (rest.length > 0 ? '\n' : ''));
  return first ?? null;
}

beforeEach(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Dispatch queue', () => {
  test('enqueue adds entry to file', () => {
    appendEntry({ taskId: 'task-001', targetAgent: 'coder' });
    const entries = readEntries();
    expect(entries).toHaveLength(1);
    expect((entries[0] as { taskId: string }).taskId).toBe('task-001');
  });

  test('dequeue returns first entry and removes it', () => {
    writeEntries([
      { taskId: 'task-001', targetAgent: 'coder' },
      { taskId: 'task-002', targetAgent: 'planner' },
    ]);
    const first = dequeue() as { taskId: string };
    expect(first.taskId).toBe('task-001');
    const remaining = readEntries();
    expect(remaining).toHaveLength(1);
    expect((remaining[0] as { taskId: string }).taskId).toBe('task-002');
  });

  test('dequeue from empty queue returns null', () => {
    expect(dequeue()).toBeNull();
  });

  test('queue preserves FIFO order', () => {
    for (let i = 1; i <= 5; i++) {
      appendEntry({ taskId: `task-00${i}` });
    }
    for (let i = 1; i <= 5; i++) {
      const entry = dequeue() as { taskId: string };
      expect(entry.taskId).toBe(`task-00${i}`);
    }
    expect(dequeue()).toBeNull();
  });

  test('queue entries are valid JSON', () => {
    appendEntry({ taskId: 'task-001' });
    appendEntry({ taskId: 'task-002', targetAgent: 'coder' });
    const lines = fs.readFileSync(DISPATCH_FILE, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});
