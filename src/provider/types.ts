// Branded string types (no Effect Schema needed)
export type ProviderID = string & { readonly __brand: 'ProviderID' };
export type ModelID = string & { readonly __brand: 'ModelID' };

export function toProviderID(s: string): ProviderID { return s as ProviderID; }
export function toModelID(s: string): ModelID { return s as ModelID; }

// Model aliases
export type ModelTier = 'fast' | 'standard' | 'deep';

export interface ModelInfo {
  id: ModelID;
  providerId: ProviderID;
  name: string;
  tier: ModelTier;
  contextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  model?: ModelID;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  system?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ChatChunk {
  type: 'text' | 'tool-call' | 'done';
  text?: string;
  toolName?: string;
  toolInput?: unknown;
}

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
