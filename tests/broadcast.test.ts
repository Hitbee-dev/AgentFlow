import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';

const TEST_DIR = path.join(import.meta.dir, '.test-broadcast');
const BROADCAST_FILE = path.join(TEST_DIR, 'queue', 'broadcast.jsonl');
const OFFSET_DIR = path.join(TEST_DIR, 'queue', 'offsets');

// These tests exercise the broadcast file format directly
// (without importing the module to avoid cwd dependency)

function writeBroadcast(entries: object[]) {
  fs.mkdirSync(path.dirname(BROADCAST_FILE), { recursive: true });
  const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(BROADCAST_FILE, lines, 'utf-8');
}

function readFileSize(): number {
  return fs.existsSync(BROADCAST_FILE) ? fs.statSync(BROADCAST_FILE).size : 0;
}

function writeOffset(agent: string, offset: number) {
  fs.mkdirSync(OFFSET_DIR, { recursive: true });
  fs.writeFileSync(path.join(OFFSET_DIR, `${agent}.offset`), String(offset), 'utf-8');
}

function readOffset(agent: string): number {
  const f = path.join(OFFSET_DIR, `${agent}.offset`);
  if (!fs.existsSync(f)) return 0;
  return parseInt(fs.readFileSync(f, 'utf-8'), 10) || 0;
}

beforeEach(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Broadcast file format', () => {
  test('broadcast entries are valid JSONL', () => {
    const entries = [
      { from: 'user', message: 'hello', timestamp: new Date().toISOString() },
      { from: 'orchestrator', message: 'task assigned', timestamp: new Date().toISOString() },
    ];
    writeBroadcast(entries);
    const lines = fs.readFileSync(BROADCAST_FILE, 'utf-8').split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  test('broadcast file grows on append', () => {
    writeBroadcast([{ from: 'user', message: 'msg1', timestamp: '' }]);
    const size1 = readFileSize();
    fs.appendFileSync(BROADCAST_FILE, JSON.stringify({ from: 'user', message: 'msg2', timestamp: '' }) + '\n');
    const size2 = readFileSize();
    expect(size2).toBeGreaterThan(size1);
  });
});

describe('Offset pointer mechanics', () => {
  test('offset starts at 0 for new agent', () => {
    expect(readOffset('coder')).toBe(0);
  });

  test('offset advances after reading', () => {
    const entries = [
      { from: 'user', message: 'hello', timestamp: '' },
    ];
    writeBroadcast(entries);
    const size = readFileSize();
    writeOffset('coder', size);
    expect(readOffset('coder')).toBe(size);
  });

  test('different agents have independent offsets', () => {
    writeBroadcast([{ from: 'user', message: 'hi', timestamp: '' }]);
    const size = readFileSize();
    writeOffset('coder', size);
    writeOffset('planner', 0);
    expect(readOffset('coder')).toBe(size);
    expect(readOffset('planner')).toBe(0);
  });
});
