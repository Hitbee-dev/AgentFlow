import { keychain } from './keychain.ts';
import { generateCodeVerifier, generateCodeChallenge, generateState } from './crypto.ts';

const ACCOUNT_ACCESS_TOKEN = 'gemini-access-token';
const ACCOUNT_REFRESH_TOKEN = 'gemini-refresh-token';
const ACCOUNT_API_KEY = 'gemini-api-key';
const ACCOUNT_KEY_TYPE = 'gemini-key-type'; // 'oauth' | 'api-key'

// Google OAuth constants (requires GCP client ID)
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = ['https://www.googleapis.com/auth/generative-language', 'openid', 'email'];

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? ['open', url] : ['xdg-open', url];
  Bun.spawn(cmd, { stdout: 'ignore', stderr: 'ignore' });
}

async function findFreePort(): Promise<number> {
  const server = Bun.serve({ port: 0, fetch() { return new Response(''); } });
  const port = server.port ?? 0;
  server.stop();
  return port;
}

async function startCallbackServer(port: number, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = Bun.serve({
      port,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== '/callback') return new Response('Not found', { status: 404 });
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        server.stop();
        if (error) { reject(new Error(`OAuth error: ${error}`)); }
        else if (state !== expectedState) { reject(new Error('Invalid state')); }
        else if (!code) { reject(new Error('No code received')); }
        else { resolve(code); }
        return new Response(
          '<html><body><h2>Gemini authentication complete!</h2><p>You may close this tab.</p></body></html>',
          { headers: { 'Content-Type': 'text/html' } },
        );
      },
    });
  });
}

export class GeminiOAuth {
  /** Store a Gemini API key (from Google AI Studio — simpler than OAuth) */
  async setApiKey(apiKey: string): Promise<void> {
    await keychain.set(ACCOUNT_API_KEY, apiKey);
    await keychain.set(ACCOUNT_KEY_TYPE, 'api-key');
    console.log('Gemini API key stored successfully.');
  }

  /** Full Google OAuth flow — requires GCP_CLIENT_ID env or config */
  async login(): Promise<void> {
    const clientId = process.env['GOOGLE_CLIENT_ID'];
    if (!clientId) {
      throw new Error(
        'GOOGLE_CLIENT_ID environment variable is required for Gemini OAuth.\n' +
        'Alternative: use an API key from Google AI Studio:\n' +
        '  agentflow auth add --provider gemini --key AIza...',
      );
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();
    const port = await findFreePort();
    const redirectUri = `http://localhost:${port}/callback`;

    const authUrl = new URL(AUTHORIZE_URL);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', SCOPES.join(' '));
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    console.log('Opening browser for Google authentication...');
    console.log(`If the browser does not open, visit:\n  ${authUrl.toString()}\n`);

    const codePromise = startCallbackServer(port, state);
    openBrowser(authUrl.toString());
    const authCode = await codePromise;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${text}`);
    }

    const tokens = (await response.json()) as TokenResponse;
    await Promise.all([
      keychain.set(ACCOUNT_ACCESS_TOKEN, tokens.access_token),
      tokens.refresh_token ? keychain.set(ACCOUNT_REFRESH_TOKEN, tokens.refresh_token) : Promise.resolve(),
      keychain.set(ACCOUNT_KEY_TYPE, 'oauth'),
    ]);
    console.log('Gemini authentication successful.');
  }

  async logout(): Promise<void> {
    await Promise.all([
      keychain.delete(ACCOUNT_ACCESS_TOKEN),
      keychain.delete(ACCOUNT_REFRESH_TOKEN),
      keychain.delete(ACCOUNT_API_KEY),
      keychain.delete(ACCOUNT_KEY_TYPE),
    ]);
  }

  async isValid(): Promise<boolean> {
    const keyType = await keychain.get(ACCOUNT_KEY_TYPE);
    if (keyType === 'api-key') {
      const key = await keychain.get(ACCOUNT_API_KEY);
      return key !== null && key.length > 10;
    }
    const token = await keychain.get(ACCOUNT_ACCESS_TOKEN);
    return token !== null;
  }

  async getAccessToken(): Promise<string | null> {
    const keyType = await keychain.get(ACCOUNT_KEY_TYPE);
    if (keyType === 'api-key') return keychain.get(ACCOUNT_API_KEY);
    return keychain.get(ACCOUNT_ACCESS_TOKEN);
  }
}
