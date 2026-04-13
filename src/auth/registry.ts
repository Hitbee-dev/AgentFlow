import type { ProviderConfig } from '../types/index.ts';
import { ClaudeOAuth } from './claude-oauth.ts';
import { GeminiOAuth } from './gemini-oauth.ts';
import { OpenAIAuth } from './openai.ts';

export interface ProviderAuthStatus {
  provider: string;
  authMethod: 'oauth' | 'api-key';
  isValid: boolean;
  expiresAt?: string;
}

const claudeOAuth = new ClaudeOAuth();
const geminiOAuth = new GeminiOAuth();
const openAIAuth = new OpenAIAuth();

const PROVIDERS: ProviderConfig[] = [
  { providerId: 'claude', models: [], defaultModel: '', authMethod: 'oauth' },
  { providerId: 'gemini', models: [], defaultModel: '', authMethod: 'oauth' },
  { providerId: 'openai', models: [], defaultModel: '', authMethod: 'api-key' },
];

async function isProviderValid(providerId: string): Promise<boolean> {
  switch (providerId) {
    case 'claude':
      return claudeOAuth.isValid();
    case 'gemini':
      return geminiOAuth.isValid();
    case 'openai':
      return openAIAuth.isValid();
    default:
      return false;
  }
}

export class AuthRegistry {
  async isValid(providerId: string): Promise<boolean> {
    return isProviderValid(providerId);
  }

  async getStatus(): Promise<ProviderAuthStatus[]> {
    return Promise.all(
      PROVIDERS.map(async (p) => ({
        provider: p.providerId,
        authMethod: p.authMethod,
        isValid: await isProviderValid(p.providerId),
      })),
    );
  }

  async refreshIfNeeded(providerId: string): Promise<void> {
    if (providerId === 'claude') {
      const valid = await claudeOAuth.isValid();
      if (!valid) {
        await claudeOAuth.refresh();
      }
    }
    // Gemini and OpenAI do not have a refresh mechanism yet
  }

  async getAccessToken(providerId: string): Promise<string | null> {
    switch (providerId) {
      case 'anthropic':
        return claudeOAuth.getAccessToken();
      case 'google':
        return geminiOAuth.getAccessToken();
      case 'openai':
        return openAIAuth.getKey();
      default:
        return null;
    }
  }
}

export const authRegistry = new AuthRegistry();
