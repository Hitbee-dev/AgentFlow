import { keychain } from './keychain.ts';

const ACCOUNT_API_KEY = 'openai-api-key';

export class OpenAIAuth {
  async setKey(apiKey: string): Promise<void> {
    await keychain.set(ACCOUNT_API_KEY, apiKey);
  }

  async getKey(): Promise<string | null> {
    return keychain.get(ACCOUNT_API_KEY);
  }

  async removeKey(): Promise<void> {
    await keychain.delete(ACCOUNT_API_KEY);
  }

  async isValid(): Promise<boolean> {
    const key = await keychain.get(ACCOUNT_API_KEY);
    return key !== null && key.startsWith('sk-');
  }
}
