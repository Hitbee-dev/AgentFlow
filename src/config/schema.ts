import { z } from 'zod';

export const AgentConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  prompt: z.string(),
  model: z.string(),
  provider: z.string(),
  namespace: z.string(),
});

export const ProviderConfigSchema = z.object({
  providerId: z.string(),
  models: z.array(z.string()),
  defaultModel: z.string(),
  authMethod: z.enum(['oauth', 'api-key']),
});

export const AppConfigSchema = z.object({
  providers: z.record(z.string(), ProviderConfigSchema),
  agents: z.record(z.string(), AgentConfigSchema),
  defaults: z.object({
    provider: z.string(),
    model: z.string(),
    namespace: z.string(),
  }),
});
