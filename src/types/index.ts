export type AgentStatus = 'idle' | 'running' | 'error' | 'stopped';

export interface HeartbeatPayload {
  agentName: string;
  status: AgentStatus;
  timestamp: string;
  taskId?: string;
}

export type TaskState = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CommandInput {
  raw: string;
  targetAgent?: string;
  isBroadcast: boolean;
}

export interface AgentConfig {
  name: string;
  description: string;
  prompt: string;
  model: string;
  provider: string;
  namespace: string;
}

export interface ProviderConfig {
  providerId: string;
  models: string[];
  defaultModel: string;
  authMethod: 'oauth' | 'api-key';
}

export interface AppConfig {
  providers: Record<string, ProviderConfig>;
  agents: Record<string, AgentConfig>;
  defaults: {
    provider: string;
    model: string;
    namespace: string;
  };
}
