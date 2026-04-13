import { Command } from 'commander';
import { ClaudeOAuth } from '../auth/claude-oauth.ts';
import { GeminiOAuth } from '../auth/gemini-oauth.ts';
import { OpenAIAuth } from '../auth/openai.ts';
import { authRegistry } from '../auth/registry.ts';

const claudeOAuth = new ClaudeOAuth();
const geminiOAuth = new GeminiOAuth();
const openAIAuth = new OpenAIAuth();

export function buildAuthCommand(): Command {
  const auth = new Command('auth').description('Manage provider authentication');

  // agentflow auth login  →  Claude OAuth
  auth
    .command('login')
    .description('Log in to Claude via OAuth')
    .action(async () => {
      try {
        await claudeOAuth.login();
      } catch (err) {
        console.error(`Login failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // agentflow auth add --provider <name> [--key <value>]
  auth
    .command('add')
    .description('Add credentials for a provider')
    .requiredOption('--provider <name>', 'Provider name (claude, gemini, openai)')
    .option('--key <apiKey>', 'API key (for api-key providers)')
    .action(async (opts: { provider: string; key?: string }) => {
      const { provider, key } = opts;

      try {
        switch (provider) {
          case 'claude':
            await claudeOAuth.login();
            break;

          case 'gemini':
            await geminiOAuth.login();
            break;

          case 'openai': {
            if (!key) {
              console.error('--key <apiKey> is required for openai');
              process.exit(1);
            }
            await openAIAuth.setKey(key);
            console.log('OpenAI API key stored successfully.');
            break;
          }

          default:
            console.error(`Unknown provider: ${provider}. Valid: claude, gemini, openai`);
            process.exit(1);
        }
      } catch (err) {
        console.error(`Failed to add credentials: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // agentflow auth status
  auth
    .command('status')
    .description('Show authentication status for all providers')
    .action(async () => {
      try {
        const statuses = await authRegistry.getStatus();
        const configured = statuses.filter((s) => s.isValid);

        if (configured.length === 0) {
          console.log('No providers configured.');
          console.log('');
          console.log('  agentflow auth login                         # Claude OAuth');
          console.log('  agentflow auth add --provider openai --key sk-xxx  # OpenAI');
          return;
        }

        console.log('Provider Auth Status');
        console.log('─'.repeat(50));
        for (const s of statuses) {
          const status = s.isValid ? '✓ valid' : '✗ not configured';
          const method = s.authMethod === 'oauth' ? 'OAuth' : 'API key';
          console.log(`  ${s.provider.padEnd(10)} ${method.padEnd(10)} ${status}`);
        }
      } catch (err) {
        console.error(`Status check failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // agentflow auth logout [--provider <name>]
  auth
    .command('logout')
    .description('Remove stored credentials')
    .option('--provider <name>', 'Provider to log out (claude, gemini, openai); omit to log out all')
    .action(async (opts: { provider?: string }) => {
      const { provider } = opts;

      try {
        if (!provider || provider === 'claude') {
          await claudeOAuth.logout();
          console.log('Claude credentials removed.');
        }
        if (!provider || provider === 'gemini') {
          await geminiOAuth.logout();
          console.log('Gemini credentials removed.');
        }
        if (!provider || provider === 'openai') {
          await openAIAuth.removeKey();
          console.log('OpenAI credentials removed.');
        }
        if (
          provider &&
          !['claude', 'gemini', 'openai'].includes(provider)
        ) {
          console.error(`Unknown provider: ${provider}`);
          process.exit(1);
        }
      } catch (err) {
        console.error(`Logout failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return auth;
}
