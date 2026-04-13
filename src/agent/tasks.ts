/**
 * Task CRUD for AgentFlow
 *
 * Task files stored at: .agent-cli/tasks/<taskId>.json
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { TaskState } from '../types/index.js';

export interface Task {
  id: string;
  description: string;
  state: TaskState;
  assignedAgent?: string;
  createdAt: string;
  updatedAt: string;
  branch?: string;
  planPath?: string;
}

const TASKS_DIR = path.join('.agent-cli', 'tasks');

function taskPath(taskId: string): string {
  return path.join(TASKS_DIR, `${taskId}.json`);
}

function ensureTasksDir(): void {
  fs.mkdirSync(TASKS_DIR, { recursive: true });
}

/** Create a new task with state 'pending'. Returns the created Task. */
export function createTask(description: string): Task {
  ensureTasksDir();
  const now = new Date().toISOString();
  const task: Task = {
    id: randomUUID(),
    description,
    state: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  fs.writeFileSync(taskPath(task.id), JSON.stringify(task, null, 2), 'utf-8');
  return task;
}

/** Update fields on a task. Returns the updated Task or null if not found. */
export function updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Task | null {
  const existing = getTask(id);
  if (!existing) return null;
  const updated: Task = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(taskPath(id), JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

/** Get a task by ID. Returns null if not found or malformed. */
export function getTask(id: string): Task | null {
  const filePath = taskPath(id);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Task;
  } catch {
    return null;
  }
}

/** List all tasks, optionally filtered by state. */
export function listTasks(state?: TaskState): Task[] {
  ensureTasksDir();
  const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
  const tasks: Task[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(TASKS_DIR, file), 'utf-8');
      const task = JSON.parse(raw) as Task;
      if (!state || task.state === state) {
        tasks.push(task);
      }
    } catch {
      // skip malformed
    }
  }
  return tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Delete a task by ID. */
export function deleteTask(id: string): void {
  const filePath = taskPath(id);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
