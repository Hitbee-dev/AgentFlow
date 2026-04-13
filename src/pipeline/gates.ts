import fs from 'fs';

export type GateStatus = 'pending' | 'pass' | 'fail';

export interface GateResult {
  gate: string;        // 'security-review' | 'code-review' | 'qa-test'
  status: GateStatus;
  agentName: string;
  summary?: string;
  timestamp: string;
}

const PIPELINE_DIR = '.agent-cli/pipeline';

export function saveGateResult(pipelineId: string, result: GateResult): void {
  const dir = `${PIPELINE_DIR}/${pipelineId}/gates`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/${result.gate}.json`, JSON.stringify(result, null, 2));
}

export function getGateResult(pipelineId: string, gate: string): GateResult | null {
  const path = `${PIPELINE_DIR}/${pipelineId}/gates/${gate}.json`;
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, 'utf-8')) as GateResult;
}

export function allGatesPass(pipelineId: string): boolean {
  const required = ['security-review', 'code-review', 'qa-test'];
  return required.every(gate => {
    const result = getGateResult(pipelineId, gate);
    return result?.status === 'pass';
  });
}

export function anyGateFailed(pipelineId: string): boolean {
  const required = ['security-review', 'code-review', 'qa-test'];
  return required.some(gate => getGateResult(pipelineId, gate)?.status === 'fail');
}
