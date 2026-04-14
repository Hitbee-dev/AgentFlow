import fs from 'fs';
import { PIPELINE_STAGES, type StageName } from './stages/index.ts';
import { saveGateResult } from './gates.ts';
import { submitTask } from '../orchestrator/lifecycle.ts';

export type PipelineStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface Pipeline {
  id: string;
  description: string;
  branch: string;
  currentStage: StageName;
  status: PipelineStatus;
  createdAt: string;
  updatedAt: string;
  taskIds: Record<string, string>; // stage -> taskId
}

const PIPELINE_DIR = '.agent-cli/pipeline';

function savePipeline(pipeline: Pipeline): void {
  fs.mkdirSync(`${PIPELINE_DIR}/${pipeline.id}`, { recursive: true });
  fs.writeFileSync(`${PIPELINE_DIR}/${pipeline.id}/pipeline.json`, JSON.stringify(pipeline, null, 2));
}

function loadPipeline(id: string): Pipeline | null {
  const path = `${PIPELINE_DIR}/${id}/pipeline.json`;
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, 'utf-8')) as Pipeline;
}

function listPipelines(): Pipeline[] {
  if (!fs.existsSync(PIPELINE_DIR)) return [];
  return fs.readdirSync(PIPELINE_DIR)
    .map(id => loadPipeline(id))
    .filter(Boolean) as Pipeline[];
}

function branchName(description: string): string {
  return 'feature/' + description.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}

export async function startPipeline(description: string): Promise<Pipeline> {
  const id = crypto.randomUUID();
  const branch = branchName(description);

  const pipeline: Pipeline = {
    id, description, branch,
    currentStage: 'branch-create',
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    taskIds: {},
  };
  savePipeline(pipeline);

  // Execute branch-create (system action — git)
  const branchProc = Bun.spawnSync(['git', 'checkout', '-b', branch]);
  if (branchProc.exitCode !== 0) {
    pipeline.status = 'failed';
    savePipeline(pipeline);
    throw new Error(`Failed to create branch: ${branch}`);
  }

  // Advance to plan stage
  pipeline.currentStage = 'plan';
  pipeline.updatedAt = new Date().toISOString();
  savePipeline(pipeline);

  // Submit tasks for agent-handled stages
  const agentStages: StageName[] = ['plan', 'implement', 'security-review', 'code-review', 'qa-test'];
  for (const stageName of agentStages) {
    const stage = PIPELINE_STAGES.find(s => s.name === stageName)!;
    const taskId = await submitTask(`[${stageName}] ${description}`, stage.agentRole === 'system' ? undefined : stage.agentRole);
    pipeline.taskIds[stageName] = taskId;
    pipeline.currentStage = stageName;
    pipeline.updatedAt = new Date().toISOString();
    savePipeline(pipeline);

    // Gate check after review stages
    if (stage.gateRequired && stage.gateName) {
      // Record gate as pending for now (real result comes from agent)
      saveGateResult(id, {
        gate: stage.gateName,
        status: 'pending',
        agentName: stage.agentRole,
        timestamp: new Date().toISOString(),
      });
    }
  }

  pipeline.currentStage = 'pr-create';
  pipeline.updatedAt = new Date().toISOString();
  savePipeline(pipeline);

  // pr-create: run gh pr create (stub)
  console.log(`[pipeline] Would create PR for branch: ${branch}`);

  pipeline.status = 'completed';
  pipeline.updatedAt = new Date().toISOString();
  savePipeline(pipeline);

  return pipeline;
}

export function getPipelineStatus(id: string): Pipeline | null {
  return loadPipeline(id);
}

export function getActivePipelines(): Pipeline[] {
  return listPipelines().filter(p => p.status === 'running');
}

export function cancelPipeline(id: string): void {
  const pipeline = loadPipeline(id);
  if (!pipeline) return;
  pipeline.status = 'cancelled';
  pipeline.updatedAt = new Date().toISOString();
  savePipeline(pipeline);
}
