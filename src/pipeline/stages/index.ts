export type StageName = 'branch-create' | 'plan' | 'implement' | 'security-review' | 'code-review' | 'qa-test' | 'pr-create';

export interface StageDefinition {
  name: StageName;
  agentRole: string;       // Which agent role handles this stage
  description: string;
  gateRequired: boolean;   // Does this stage produce a gate result?
  gateName?: string;       // Gate key if gateRequired
}

export const PIPELINE_STAGES: StageDefinition[] = [
  { name: 'branch-create', agentRole: 'system', description: 'Create feature branch', gateRequired: false },
  { name: 'plan', agentRole: 'planner', description: 'Write implementation plan', gateRequired: false },
  { name: 'implement', agentRole: 'coder', description: 'Implement the feature', gateRequired: false },
  { name: 'security-review', agentRole: 'security', description: 'Security review', gateRequired: true, gateName: 'security-review' },
  { name: 'code-review', agentRole: 'reviewer', description: 'Code review', gateRequired: true, gateName: 'code-review' },
  { name: 'qa-test', agentRole: 'qa', description: 'QA testing', gateRequired: true, gateName: 'qa-test' },
  { name: 'pr-create', agentRole: 'system', description: 'Create pull request', gateRequired: false },
];
