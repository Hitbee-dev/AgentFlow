/**
 * Claude CLI-based chat provider.
 *
 * Uses the `claude` binary as a subprocess instead of calling the Anthropic API
 * directly. This allows Sonnet/Opus access via OAuth (Claude.ai subscription),
 * which the direct API path blocks for third-party apps.
 *
 * Falls back to the SDK-based chat() when the `claude` binary is not found.
 */

import type { ChatMessage, ChatOptions, ChatChunk } from './types.ts';
import { chat as sdkChat } from './chat.ts';

function findClaudeBinary(): string | null {
  const candidates = [
    `${process.env.HOME}/.superset/bin/claude`,
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];
  for (const p of candidates) {
    try {
      const result = Bun.spawnSync(['test', '-x', p], { stderr: 'ignore' });
      if (result.exitCode === 0) return p;
    } catch { /* skip */ }
  }
  // Try PATH
  const which = Bun.spawnSync(['which', 'claude'], { stdout: 'pipe', stderr: 'ignore' });
  if (which.exitCode === 0) {
    const bin = new TextDecoder().decode(which.stdout).trim();
    if (bin) return bin;
  }
  return null;
}

function buildPrompt(messages: ChatMessage[], system?: string): string {
  const parts: string[] = [];
  if (system) {
    parts.push(`<system>\n${system}\n</system>\n`);
  }
  for (const msg of messages) {
    const role = msg.role === 'user' ? 'Human' : 'Assistant';
    parts.push(`${role}: ${msg.content}`);
  }
  parts.push('Assistant:');
  return parts.join('\n\n');
}

export async function* chatViaCli(
  messages: ChatMessage[],
  options: ChatOptions = {},
): AsyncGenerator<ChatChunk> {
  const claudeBin = findClaudeBinary();
  if (!claudeBin) {
    // Fall back to SDK-based chat
    yield* sdkChat(messages, options);
    return;
  }

  const model = options.model ?? 'claude-sonnet-4-6';
  const prompt = buildPrompt(messages, options.system);

  // Get OAuth token for ANTHROPIC_AUTH_TOKEN
  const { authRegistry } = await import('../auth/registry.ts');
  const oauthToken = await authRegistry.getAccessToken('anthropic');

  const env: Record<string, string> = { ...process.env as Record<string, string> };
  if (oauthToken && !env['ANTHROPIC_API_KEY']) {
    env['ANTHROPIC_AUTH_TOKEN'] = oauthToken;
  }

  const proc = Bun.spawn(
    [claudeBin, '--model', model as string, '--print'],
    {
      stdin: new TextEncoder().encode(prompt),
      stdout: 'pipe',
      stderr: 'pipe',
      env,
    },
  );

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  if (output.trim()) {
    yield { type: 'text', text: output.trim() };
  }
  yield { type: 'done' };
}
