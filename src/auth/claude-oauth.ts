import { keychain } from './keychain.ts';
import { generateCodeVerifier, generateCodeChallenge, generateState } from './crypto.ts';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTHORIZE_URL = 'https://claude.com/cai/oauth/authorize';
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const OAUTH_BETA_HEADER = 'oauth-2025-04-20';
const SCOPES = [
  'user:profile',
  'user:inference',
  'user:sessions:claude_code',
  'user:mcp_servers',
  'user:file_upload',
];

const ACCOUNT_ACCESS_TOKEN = 'claude-access-token';
const ACCOUNT_REFRESH_TOKEN = 'claude-refresh-token';
const ACCOUNT_EXPIRES_AT = 'claude-expires-at';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

async function findFreePort(): Promise<number> {
  const server = Bun.serve({
    port: 0,
    fetch() {
      return new Response('');
    },
  });
  const port = server.port ?? 0;
  server.stop();
  return port;
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? ['open', url] : ['xdg-open', url];
  Bun.spawn(cmd, { stdout: 'ignore', stderr: 'ignore' });
}

async function startCallbackServer(
  port: number,
  expectedState: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = Bun.serve({
      port,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== '/callback') {
          return new Response('Not found', { status: 404 });
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          server.stop();
          reject(new Error(`OAuth error: ${error}`));
          return new Response(
            '<html><body><h2>Authentication failed.</h2><p>You may close this tab.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } },
          );
        }

        if (state !== expectedState) {
          server.stop();
          reject(new Error('Invalid state parameter — possible CSRF attack'));
          return new Response(
            '<html><body><h2>Authentication failed: invalid state.</h2></body></html>',
            { headers: { 'Content-Type': 'text/html' } },
          );
        }

        if (!code) {
          server.stop();
          reject(new Error('No authorization code received'));
          return new Response(
            '<html><body><h2>Authentication failed: no code.</h2></body></html>',
            { headers: { 'Content-Type': 'text/html' } },
          );
        }

        server.stop();
        resolve(code);
        return new Response(
          '<html><body><h2>Authentication successful!</h2><p>You may close this tab and return to AgentFlow.</p></body></html>',
          { headers: { 'Content-Type': 'text/html' } },
        );
      },
    });
  });
}

export class ClaudeOAuth {
  async login(): Promise<void> {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    const port = await findFreePort();
    const redirectUri = `http://localhost:${port}/callback`;

    const authUrl = new URL(AUTHORIZE_URL);
    authUrl.searchParams.set('code', 'true');  // show Claude Max upsell on login page
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', SCOPES.join(' '));
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    console.log(`Opening browser for Claude authentication...`);
    console.log(`If the browser does not open, visit:\n  ${authUrl.toString()}\n`);

    const codePromise = startCallbackServer(port, state);
    openBrowser(authUrl.toString());

    const authCode = await codePromise;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'anthropic-beta': OAUTH_BETA_HEADER,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${text}`);
    }

    const tokens = (await response.json()) as TokenResponse;
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    await Promise.all([
      keychain.set(ACCOUNT_ACCESS_TOKEN, tokens.access_token),
      tokens.refresh_token
        ? keychain.set(ACCOUNT_REFRESH_TOKEN, tokens.refresh_token)
        : Promise.resolve(),
      keychain.set(ACCOUNT_EXPIRES_AT, String(expiresAt)),
    ]);

    console.log('Claude authentication successful.');
  }

  async refresh(): Promise<void> {
    const refreshToken = await keychain.get(ACCOUNT_REFRESH_TOKEN);
    if (!refreshToken) {
      throw new Error('No refresh token stored. Please run `agentflow auth login` first.');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'anthropic-beta': OAUTH_BETA_HEADER,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${text}`);
    }

    const tokens = (await response.json()) as TokenResponse;
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    await Promise.all([
      keychain.set(ACCOUNT_ACCESS_TOKEN, tokens.access_token),
      tokens.refresh_token
        ? keychain.set(ACCOUNT_REFRESH_TOKEN, tokens.refresh_token)
        : Promise.resolve(),
      keychain.set(ACCOUNT_EXPIRES_AT, String(expiresAt)),
    ]);
  }

  async logout(): Promise<void> {
    await Promise.all([
      keychain.delete(ACCOUNT_ACCESS_TOKEN),
      keychain.delete(ACCOUNT_REFRESH_TOKEN),
      keychain.delete(ACCOUNT_EXPIRES_AT),
    ]);
  }

  async isValid(): Promise<boolean> {
    const [accessToken, expiresAtStr] = await Promise.all([
      keychain.get(ACCOUNT_ACCESS_TOKEN),
      keychain.get(ACCOUNT_EXPIRES_AT),
    ]);

    if (!accessToken) return false;

    if (expiresAtStr) {
      const expiresAt = Number(expiresAtStr);
      const bufferMs = 5 * 60 * 1000;
      if (Date.now() + bufferMs >= expiresAt) return false;
    }

    return true;
  }

  async getAccessToken(): Promise<string | null> {
    const valid = await this.isValid();
    if (!valid) {
      const refreshToken = await keychain.get(ACCOUNT_REFRESH_TOKEN);
      if (refreshToken) {
        try {
          await this.refresh();
        } catch {
          return null;
        }
      } else {
        return null;
      }
    }
    return keychain.get(ACCOUNT_ACCESS_TOKEN);
  }
}
