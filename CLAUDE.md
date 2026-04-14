# AgentFlow — Developer Notes

## Runtime
- **Bun** (not Node). Use `bun run build` to compile, `bun test` for tests.
- Single binary output: `dist/agentflow` via `bun build --compile`.
- Install locally: `cp dist/agentflow ~/.local/bin/agentflow`

## Critical Bugs Fixed

### 1. Claude OAuth — token exchange must be JSON, not form-urlencoded
The `/v1/oauth/token` endpoint requires `Content-Type: application/json` with a JSON body.
Sending `application/x-www-form-urlencoded` returns `400 Invalid request format`.
Also requires `state` field in the body and `anthropic-beta: oauth-2025-04-20` header.
→ `src/auth/claude-oauth.ts`

### 2. Claude OAuth — access token must use `Authorization: Bearer`, not `x-api-key`
OAuth tokens are not API keys. Passing them as `apiKey` to `createAnthropic()` sends them
as `x-api-key` and gets `401 invalid x-api-key`. Fix: intercept fetch, swap headers.
→ `src/provider/registry.ts`

### 3. tmux commands — use `Bun.spawnSync`, never `Bun.spawn` with piped stderr
`Bun.spawn` with `stderr: 'pipe'` that is never consumed causes OS pipe buffer deadlock.
The subprocess blocks writing to stderr → parent blocks waiting for exit → hang.
Use `Bun.spawnSync` with `stderr: 'ignore'` for all tmux subcommands.
→ `src/agent/tmux-manager.ts`

### 4. Ink `Text` conflicts with DOM `Text` global
Import as `import { Text as InkText } from 'ink'` in App.tsx.

### 5. Broadcast prefix must be all-Korean: `공지!`
Mixed Chinese/Korean `公지!` caused command not to be recognized.
→ `src/orchestrator/manual.ts`

## Architecture Boundaries
- `src/auth/` — credential storage (OS keychain via `security` CLI on macOS)
- `src/provider/` — Vercel AI SDK abstraction; one provider instance per auth
- `src/agent/` — tmux session lifecycle, heartbeat, dispatch queue, broadcast
- `src/orchestrator/` — task routing (auto by type, manual by `@agent`)
- `src/pipeline/` — branch→implement→review→PR automation
- `src/tui/` — React/Ink TUI dashboard
- `src/cli/` — Commander.js CLI entry points

## OAuth Scopes (Claude)
```
user:profile  user:inference  user:sessions:claude_code  user:mcp_servers  user:file_upload
```
CLIENT_ID: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`

### 4. `--minify` breaks compiled binary startup (dynamic import → static)
`bun build --compile --minify` converts dynamic `import('../tui/index.ts')` to a static
import, causing the TUI to load on every CLI invocation (hangs non-TTY contexts).
Build without `--minify`. Binary size difference is negligible.
→ `package.json` build script

### 5. macOS binary cache — always `rm` before `cp` when replacing binaries
`cp dist/agentflow ~/.local/bin/agentflow` keeps the old binary in the macOS page cache.
Use `rm ~/.local/bin/agentflow && cp dist/agentflow ~/.local/bin/agentflow` for a clean install.

### 6. `Bun.spawnSync` for all tmux subcommands (was: async spawn + pipe deadlock)
`Bun.spawn` with `stderr: 'pipe'` that is never consumed deadlocks when stderr output fills
the OS pipe buffer. All tmux commands are short-lived; use `Bun.spawnSync` + `stderr: 'ignore'`.
→ `src/agent/tmux-manager.ts` (was item 3 — same root issue, more complete fix)

### 7. Claude OAuth — direct API (`/v1/messages`) blocks Sonnet/Opus; use `claude` CLI instead
OAuth Bearer tokens only allow `claude-haiku-4-5-20251001` via direct API calls.
Sonnet/Opus return `rate_limit_error: "Error"` (no rate-limit headers) — model-access restriction.
Fix: use the `claude` CLI binary as a subprocess (like Paperclip does) — pass `ANTHROPIC_AUTH_TOKEN`
and `--model claude-sonnet-4-6`. The CLI handles auth internally and has full model access.
→ `src/provider/chat-cli.ts`

### 8. SDK appends extra `anthropic-beta` flags — must override to `oauth-2025-04-20` only
`@ai-sdk/anthropic` merges its own beta flags (e.g. `fine-grained-tool-streaming-2025-05-14`) into
the `anthropic-beta` header. For OAuth requests, override in the fetch interceptor:
`headers.set('anthropic-beta', 'oauth-2025-04-20')` after the SDK sets its defaults.
→ `src/provider/registry.ts`

### 9. Agent completion — agents must say "TASK COMPLETE" to mark task done
The execution loop detects `assistantResponse.includes('TASK COMPLETE')` to set `completed=true`.
Without this signal, tasks run until `maxTurns` (20) then are marked `failed`.
System prompt in execution.ts appends: "end your final response with exactly: TASK COMPLETE".
→ `src/agent/execution.ts`

## Testing
```bash
bun test               # unit + integration tests
bun run dev            # run CLI without compiling
```
