import { describe, test, expect } from 'bun:test';
import { parseCommand } from '../src/orchestrator/manual.ts';

describe('parseCommand', () => {
  test(':quit → system command', () => {
    const r = parseCommand(':quit');
    expect(r.type).toBe('system');
    expect(r.command).toBe('quit');
  });

  test(':q → system quit', () => {
    const r = parseCommand(':q');
    expect(r.type).toBe('system');
    expect(r.command).toBe('q');
  });

  test(':ns core → system ns command', () => {
    const r = parseCommand(':ns core');
    expect(r.type).toBe('system');
    expect(r.command).toBe('ns core');
  });

  test('@coder implement login → manual dispatch', () => {
    const r = parseCommand('@coder implement login feature');
    expect(r.type).toBe('manual');
    expect(r.agentName).toBe('coder');
    expect(r.task).toBe('implement login feature');
  });

  test('@planner write spec → manual dispatch', () => {
    const r = parseCommand('@planner write spec for auth');
    expect(r.type).toBe('manual');
    expect(r.agentName).toBe('planner');
    expect(r.task).toBe('write spec for auth');
  });

  test('공지! hello → system broadcast command', () => {
    const r = parseCommand('공지! hello everyone');
    expect(r.type).toBe('system');
    expect(r.command).toBe('broadcast hello everyone');
  });

  test('/broadcast hello → system broadcast command', () => {
    const r = parseCommand('/broadcast hello everyone');
    expect(r.type).toBe('system');
    expect(r.command).toBe('broadcast hello everyone');
  });

  test('regular text → auto dispatch', () => {
    const r = parseCommand('implement the user auth feature');
    expect(r.type).toBe('auto');
    expect(r.task).toBe('implement the user auth feature');
  });

  test('empty string → auto (empty task)', () => {
    const r = parseCommand('');
    expect(r.type).toBe('auto');
  });

  test('@agent-only (no task) → manual with no task', () => {
    const r = parseCommand('@planner');
    expect(r.type).toBe('manual');
    expect(r.agentName).toBe('planner');
    expect(r.task).toBeUndefined();
  });
});
