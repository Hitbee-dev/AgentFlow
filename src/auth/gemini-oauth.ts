import { keychain } from './keychain.ts';

const ACCOUNT_ACCESS_TOKEN = 'gemini-access-token';
const ACCOUNT_REFRESH_TOKEN = 'gemini-refresh-token';

export class GeminiOAuth {
  // TODO: Google OAuth PKCE — requires GCP client ID configured via
  // `agentflow config set gemini.client_id <id>` before this flow can work.
  // Endpoint: https://accounts.google.com/o/oauth2/v2/auth
  // Token URL: https://oauth2.googleapis.com/token
  // Scopes: https://www.googleapis.com/auth/generative-language
  async login(): Promise<void> {
    throw new Error(
      'Gemini OAuth is not yet implemented. A GCP client ID is required.\n' +
        'Set one with: agentflow config set gemini.client_id <your-client-id>',
    );
  }

  async logout(): Promise<void> {
    await Promise.all([
      keychain.delete(ACCOUNT_ACCESS_TOKEN),
      keychain.delete(ACCOUNT_REFRESH_TOKEN),
    ]);
  }

  async isValid(): Promise<boolean> {
    const token = await keychain.get(ACCOUNT_ACCESS_TOKEN);
    return token !== null;
  }

  async getAccessToken(): Promise<string | null> {
    return keychain.get(ACCOUNT_ACCESS_TOKEN);
  }
}
