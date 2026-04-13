import { describe, test, expect } from 'bun:test';
import { classifyTask } from '../src/orchestrator/distributor.ts';

describe('classifyTask', () => {
  test('review keywords → review', () => {
    expect(classifyTask('review the PR')).toBe('review');
    expect(classifyTask('check the code')).toBe('review');
  });

  test('test keywords → test', () => {
    expect(classifyTask('test the login flow')).toBe('test');
    expect(classifyTask('verify the payment')).toBe('test');
    expect(classifyTask('qa the release')).toBe('test');
  });

  test('security keywords → security', () => {
    expect(classifyTask('security audit the auth module')).toBe('security');
    expect(classifyTask('find vulnerability in auth')).toBe('security');
  });

  test('plan keywords → plan', () => {
    expect(classifyTask('plan the new feature')).toBe('plan');
    expect(classifyTask('design the database schema')).toBe('plan');
    expect(classifyTask('write spec for login')).toBe('plan');
  });

  test('code keywords → code', () => {
    expect(classifyTask('implement user auth')).toBe('code');
    expect(classifyTask('build the API endpoint')).toBe('code');
    expect(classifyTask('fix the login bug')).toBe('code');
    expect(classifyTask('add dark mode')).toBe('code');
  });

  test('generic text → general', () => {
    expect(classifyTask('hello')).toBe('general');
    expect(classifyTask('what is the status')).toBe('general');
  });
});
