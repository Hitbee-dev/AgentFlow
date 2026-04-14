# AgentFlow Implementation Plan

**Date:** 2026-04-13 (Revised: 2026-04-13)
**Project:** AgentFlow (`agentflow-cli` on npm, binary: `agentflow`)
**Runtime:** Bun + TypeScript
**License:** Apache-2.0

---

## RALPLAN-DR Summary (Short Mode)

### Principles

1. **Local-First, Zero-Server**: Everything runs on the user's machine. No cloud dependencies for orchestration. OS keychain for secrets.
2. **Port Algorithms, Rewrite Integration Glue**: Adapt proven algorithms and core logic from source repos. Rewrite integration/DI layers in plain TypeScript rather than mechanically stripping Effect-TS or foreign plugin systems.
3. **Provider-Agnostic Core**: The runtime must treat Claude, Gemini, and OpenAI as interchangeable providers behind a unified interface, not special-cased integrations.
4. **Isolation via tmux**: Each agent gets a dedicated tmux session. No shared process state. Communication only through the file-based message queue.
5. **Incremental Delivery**: Each phase produces a working, testable artifact. No big-bang integration at the end.

### Decision Drivers (Top 3)

1. **Time-to-working-TUI**: The k9s-style dashboard is the primary user-facing deliverable. Every architectural choice should accelerate getting a functional TUI with live agent status.
2. **Source repo compatibility**: We are porting from 5 repos with different patterns (Commander.js+Ink, Effect-TS, opencode plugin system, MCP bridges). The integration seams between these determine complexity.
3. **Credential security**: Multi-provider auth with OS keychain is a hard requirement. Getting this wrong blocks all downstream provider work.

### Viable Options

#### Option A: Vercel AI SDK Provider Layer (Recommended)

Port OpenCode's `@ai-sdk/*` provider abstraction as the unified provider interface. Each provider (Claude, Gemini, OpenAI) is a Vercel AI SDK provider instance.

| Pros | Cons |
|------|------|
| Proven multi-provider abstraction from OpenCode (20+ providers already mapped) | OpenCode's provider.ts has 1735 lines with 98 Effect-TS constructs -- mechanical stripping is impossible |
| Vercel AI SDK has active ecosystem, streaming, tool-use support | Vercel AI SDK adds ~2MB bundle weight |
| Provider auth patterns already exist in OpenCode's `auth.ts` | Need to strip OpenCode's server-side auth and replace with local keychain |
| Model routing (provider/model ID pairs) already solved | Must rewrite registry, model resolution, DI layer from Effect Layer/Context to plain TypeScript |

#### Option B: Direct SDK Integration (Each Provider Native)

Use `@anthropic-ai/sdk`, `@google/generative-ai`, `openai` packages directly. Build a thin adapter layer.

| Pros | Cons |
|------|------|
| Smaller dependency footprint | Must build and maintain provider abstraction from scratch |
| No Effect-TS dependency | Tool-use, streaming, error handling differ per SDK |
| Full control over each provider's features | N * M integration matrix (N providers x M features) |
| | Loses OpenCode's battle-tested model resolution and fallback logic |

#### Option C: Keep Effect-TS as a Dependency (Rejected)

Keep OpenCode's Effect-TS-based provider layer largely intact, accepting Effect-TS as a runtime dependency.

| Pros | Cons |
|------|------|
| Fastest port path -- minimal rewriting needed | Adds 1MB+ to bundle size |
| Preserves all OpenCode provider logic as-is | Forces team to learn Effect-TS paradigm |
| | Contaminates codebase philosophy (local-first simplicity vs FP-heavy Effect patterns) |
| | Creates maintenance burden for a paradigm the team doesn't own |

**Decision: Option A.** The Vercel AI SDK abstraction from OpenCode gives us 20+ providers for free with proven streaming and tool-use. Effect-TS constructs must be **rewritten** (not mechanically stripped) in plain TypeScript. Option B would require 3-6 months of redundant adapter work. Option C was rejected because it adds 1MB+, forces the team to learn Effect-TS, and contaminates the codebase philosophy.

---

## Requirements Summary

AgentFlow is a unified, serverless, local-first multi-agent CLI orchestrator that combines:
- A k9s-style TUI for monitoring AI agents (React/Ink)
- Multi-provider LLM support (Claude OAuth, Gemini CLI/OAuth, OpenAI API key)
- Agent isolation via tmux sessions
- Hybrid task distribution (auto + manual `@agent-name`)
- File-based broadcast queue (`.agent-cli/queue/broadcast.jsonl`)
- Full automated dev pipeline (branch -> plan -> work -> review -> QA -> PR)
- OS keychain credential storage, no plaintext secrets

### Source Repos and What We Port

| Source | Key Files | What We Take |
|--------|-----------|-------------|
| `claude-code` | `src/tools/AgentTool/runAgent.ts`, `src/services/oauth/index.ts`, `src/coordinator/coordinatorMode.ts` | Agent execution loop, OAuth PKCE flow, coordinator mode logic |
| `oh-my-claudecode` | `src/agents/definitions.ts`, `src/team/` (54 modules) | Agent registry pattern, team engine (task files, inbox/outbox, heartbeat, tmux sessions, dispatch queue) |
| `opencode` | `packages/opencode/src/provider/` (provider.ts, auth.ts, schema.ts) | Vercel AI SDK multi-provider abstraction, model resolution, provider auth methods |
| `oh-my-opencode` | `src/features/background-agent/manager.ts` (1382 lines), `src/tools/delegate-task/tools.ts` | BackgroundManager (tmux lifecycle, concurrency), delegate-task (parallel agent dispatch, category routing) |
| `paperclip` | `packages/db/src/schema/auth.ts` | Multi-provider credential structure (providerId, accessToken, refreshToken pattern) |

---

## Acceptance Criteria

### Core Launch (Must Pass)

- [ ] AC-1: `agentflow` command launches k9s-style TUI within 2 seconds
- [ ] AC-2: TUI displays columns: NAME, STATUS, TASK, PROVIDER, NAMESPACE
- [ ] AC-3: Namespace filtering via `:ns <name>` works in TUI
- [ ] AC-4: Enter on agent row opens tmux pane showing agent's thinking stream
- [ ] AC-5: Command bar accepts natural language, distributes to best idle agent
- [ ] AC-6: `@agent-name task` syntax routes task to specific agent
- [ ] AC-7: `agentflow auth login` triggers Claude OAuth PKCE flow, stores tokens in OS keychain
- [ ] AC-8: `agentflow auth add --provider gemini` triggers Gemini CLI OAuth
- [ ] AC-9: `agentflow auth add --provider openai --key sk-xxx` stores key in OS keychain
- [ ] AC-10: Each agent runs in isolated tmux session named `agentflow-<name>`
- [ ] AC-11: `agentflow config set-prompt agent-1 "..."` persists custom system prompts
- [ ] AC-12: Broadcast via `@all message` queues to `.agent-cli/queue/broadcast.jsonl`
- [ ] AC-13: `claude/` is auto-added to `.gitignore`, never committed
- [ ] AC-14: Config system loads from `.agent-cli/config.json` and shared types are used across all phases

### Dev Pipeline (Must Pass)

- [ ] AC-15: Dev pipeline automates: branch creation -> plan -> work -> security review -> code review -> QA -> PR
- [ ] AC-16: PR gates require security-reviewer + code-reviewer + QA pass before merge

### Distribution (Must Pass)

- [ ] AC-17: `agentflow install` runs setup wizard (tmux check, auth, agent config)
- [ ] AC-18: `bun build --compile` produces single binary
- [ ] AC-19: `npm install -g agentflow-cli` installs and `agentflow` works
- [ ] AC-20: API keys never stored in plaintext on disk

---

## Test Strategy

- **Framework:** `bun test` (built-in Bun test runner)
- **Test location:** `src/**/__tests__/` co-located with source modules
- **Integration tests:** tmux-dependent tests require a tmux session -- gate with `AGENTFLOW_TEST_TMUX=1 bun test`
- **Convention:** Unit tests run by default. Integration tests (tmux, real OAuth, real LLM calls) run only with explicit env vars.
- **Coverage target:** Core modules (auth, provider, agent, orchestrator) should have unit tests for all public APIs.

---

## Phase-by-Phase Implementation

### Phase 0: Repository Bootstrap + Shared Types + Config System

**Goal:** Working Bun + TypeScript project with correct directory structure, shared type definitions, config system, and CI skeleton.

**Complexity:** MEDIUM (3-5 days)

**Steps:**
1. Initialize Bun project: `bun init`, configure `tsconfig.json` (strict, paths aliases)
2. Set up directory structure:
   ```
   src/
     types/          # Shared types (Phase 0)
     config/         # Config system (Phase 0)
     auth/           # Phase 1
     provider/       # Phase 2
     agent/          # Phase 3
     tui/            # Phase 4
     orchestrator/   # Phase 5
     pipeline/       # Phase 6
     utils/          # Logging, helpers
     cli/            # Commander.js entry
   ```
3. Configure `.gitignore` (include `claude/`, `.agent-cli/`, `node_modules/`, `dist/`)
   - NOTE: Use `claude/` not `./claude/` -- git does not recognize the `./` prefix
4. Set up `package.json` with `bin.agentflow`, scripts (`dev`, `build`, `test`, `lint`)
5. Add biome or eslint + prettier config
6. Create `src/cli/index.ts` with Commander.js skeleton (subcommands: `auth`, `config`, `install`)

7. **Create shared types module** at `src/types/index.ts`:
   - `AgentStatus`: enum/union -- `'idle' | 'running' | 'error' | 'stopped'`
   - `HeartbeatPayload`: `{ agentName: string, status: AgentStatus, timestamp: string, taskId?: string }`
   - `TaskState`: `'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled'`
   - `CommandInput`: `{ raw: string, targetAgent?: string, isBroadcast: boolean }`
   - `AgentConfig`: `{ name: string, description: string, prompt: string, model: string, provider: string, namespace: string }`
   - `ProviderConfig`: `{ providerId: string, models: string[], defaultModel: string, authMethod: 'oauth' | 'api-key' }`
   - All downstream phases import from `src/types/` -- no phase defines conflicting types

8. **Create config system** at `src/config/`:
   - Config file format: `.agent-cli/config.json` (JSON, not TS -- simple and user-editable)
   - Define JSON schema for config file:
     ```json
     {
       "providers": { "<id>": ProviderConfig },
       "agents": { "<name>": AgentConfig },
       "defaults": { "provider": string, "model": string, "namespace": string }
     }
     ```
   - `loadConfig()`: reads `.agent-cli/config.json`, validates with Zod, returns typed config
   - `saveConfig()`: writes validated config back to JSON
   - `ensureConfigDir()`: creates `.agent-cli/` directory structure if missing
   - CLI wiring: `agentflow config get <key>`, `agentflow config set <key> <value>`, `agentflow config set-prompt <agent> "prompt"`
   - Target: `src/config/index.ts`, `src/config/schema.ts`

9. **Create logging utility** at `src/utils/logger.ts`:
   - Structured JSON logging to `.agent-cli/logs/{agent-name}.log`
   - Agents in tmux need file-based structured logs (stdout is the agent's TUI stream)
   - Log levels: `debug`, `info`, `warn`, `error`
   - Target: `src/utils/logger.ts`

10. **Validate Ink + Bun compatibility**:
    - Install `ink` and `react`, run a minimal Ink render under `bun run`
    - Confirm Ink renders correctly before committing to React/Ink TUI in Phase 4
    - If Ink fails under Bun, document the issue and evaluate alternatives early
    - Target: `src/tui/__spike__/ink-test.tsx` (spike, delete after validation)

**Acceptance:**
- `bun run build` succeeds
- `bun run dev` prints help text
- `bun test` runs (even with 0 tests)
- `.gitignore` contains `claude/` (not `./claude/`)
- `src/types/index.ts` exports all shared types and compiles cleanly
- `loadConfig()` / `saveConfig()` round-trip a config object to `.agent-cli/config.json`
- Ink spike renders a simple component under `bun run` without errors
- AC-14 passes

**Source references:** `claude-code` Commander.js patterns in CLI entry

---

### Phase 1: Auth Layer

**Goal:** Multi-provider credential management with OS keychain storage.

**Complexity:** HIGH (5-7 days) -- OAuth PKCE + keychain is fiddly

**Steps:**
1. **Port Claude OAuth** from `claude-code/src/services/oauth/`:
   - `OAuthService` class (PKCE flow with code verifier, auth code listener)
   - Port `auth-code-listener.ts` (localhost redirect capture)
   - Port `crypto.ts` (generateCodeVerifier, generateCodeChallenge, generateState)
   - Port `client.ts` (token exchange, refresh)
   - Extract `OAuthTokens` and `OAuthProfileResponse` types from `index.ts` or `client.ts` in `claude-code/src/services/oauth/` (verify exact location -- `types.ts` does NOT exist in this directory)
   - Adapt to store tokens in OS keychain instead of file system
   - Target: `src/auth/claude-oauth.ts`

2. **Implement OS keychain adapter** via platform CLI tools (Bun-compatible, no native addons):
   - **Do NOT use `keytar`** -- it is a native Node addon that blocks `bun build --compile`
   - Shell out to platform CLI tools:
     - macOS: `security add-generic-password` / `security find-generic-password -w`
     - Linux: `secret-tool store` / `secret-tool lookup`
   - `KeychainService` class with `get(service, account)`, `set(service, account, value)`, `delete(service, account)`
   - Platform detection via `process.platform`
   - Service name: `agentflow`
   - Account pattern: `{provider}-{credential-type}` (e.g., `claude-access-token`, `openai-api-key`)
   - Target: `src/auth/keychain.ts`

3. **Implement provider auth registry** inspired by OpenCode's `ProviderAuth` and paperclip's multi-account pattern:
   - `AuthRegistry` managing credentials for multiple providers
   - Support OAuth flow (Claude, Gemini) and API key (OpenAI) auth methods
   - Model after OpenCode's `ProviderAuth.Method` schema (oauth vs api types)
   - Uses `ProviderConfig` from `src/types/` for provider configuration
   - Target: `src/auth/registry.ts`

4. **Implement Gemini CLI OAuth**:
   - Port Google OAuth patterns (Google Auth Library or manual PKCE)
   - `agentflow auth add --provider gemini` triggers browser-based OAuth
   - Target: `src/auth/gemini-oauth.ts`

5. **Wire CLI commands**:
   - `agentflow auth login` -> Claude OAuth flow
   - `agentflow auth add --provider <name> [--key <key>]` -> provider-specific flow
   - `agentflow auth status` -> list configured providers + token validity
   - `agentflow auth logout [--provider <name>]` -> remove credentials
   - Target: `src/cli/auth.ts`

**Acceptance:**
- AC-7, AC-8, AC-9, AC-20 pass
- `agentflow auth status` shows connected providers
- Token refresh works without user interaction
- Credentials stored only in OS keychain, never on disk
- Keychain adapter works on macOS (`security` CLI) and Linux (`secret-tool`)

**Source references:**
- `claude-code/src/services/oauth/index.ts` (OAuthService, PKCE)
- `claude-code/src/services/oauth/auth-code-listener.ts` (localhost redirect)
- `opencode/packages/opencode/src/provider/auth.ts` (ProviderAuth.Method schema)
- `paperclip/packages/db/src/schema/auth.ts` (multi-provider account structure)

---

### Phase 2: Provider Layer

**Goal:** Unified multi-provider LLM interface via Vercel AI SDK.

**Complexity:** HIGH (7-10 days) -- provider.ts has 1735 lines, 98 Effect-TS constructs, 15 internal module dependencies; mechanical stripping is impossible

**Steps:**
1. **Port OpenCode provider abstraction** from `opencode/packages/opencode/src/provider/`:
   - **Port** (keep as-is): Only the Vercel AI SDK factory calls (`createAnthropic()`, `createGoogleGenerativeAI()`, `createOpenAI()`) from provider.ts (~200 lines of actual value)
   - **Rewrite** (from scratch in plain TypeScript): Registry, model resolution, DI layer. Use constructor injection or module singletons -- NOT Effect `Layer`/`Context`
   - **Replace**: `Schema.brand` types from Effect with Zod-branded types or plain string union types (e.g., `ProviderID`, `ModelID`)
   - **Replace**: Effect error channel (`Effect.fail`, `Effect.catchTag`) with Result pattern (`{ ok: true, value } | { ok: false, error }`) or standard throw/catch
   - Port `models.ts` model catalog
   - Strip server-side providers we don't need (Bedrock, Vertex, Azure initially)
   - Target: `src/provider/`

2. **Implement provider configuration**:
   - Uses config system from Phase 0: `.agent-cli/config.json`
   - Map provider -> model -> auth credential (from keychain)
   - Model aliases: `fast` (haiku/flash/gpt-4o-mini), `standard` (sonnet/pro/gpt-4o), `deep` (opus/ultra/o1)
   - Target: `src/provider/config.ts`

3. **Implement streaming + tool-use wrapper**:
   - Unified `chat()` function: takes messages, returns async iterable of chunks
   - Tool-use protocol: unified tool definition -> provider-specific format
   - Error handling: rate limits, auth failures, model not found
   - Target: `src/provider/chat.ts`

4. **Implement model routing**:
   - Port OpenCode's model resolution with fallback logic (rewritten, not copied)
   - Concurrency management per provider (from `oh-my-opencode/concurrency.ts`)
   - Target: `src/provider/router.ts`

**Acceptance:**
- Can send a message to Claude, Gemini, and OpenAI through the same `chat()` interface
- Streaming works for all three providers
- Rate limit errors are caught and surfaced clearly
- Model aliases resolve correctly
- No Effect-TS imports anywhere in `src/provider/`

**Source references:**
- `opencode/packages/opencode/src/provider/provider.ts` (provider factory registry -- port only SDK factory calls)
- `opencode/packages/opencode/src/provider/schema.ts` (ProviderID, ModelID -- replace with Zod/unions)
- `opencode/packages/opencode/src/provider/transform.ts` (provider transforms)
- `oh-my-opencode/src/features/background-agent/concurrency.ts` (ConcurrencyManager)

---

### Phase 2.5: Integration Checkpoint

**Goal:** Verify Phase 1 + Phase 2 integration before proceeding to agent runtime.

**Complexity:** LOW (1-2 days)

**Steps:**
1. **End-to-end auth-to-LLM test**: One agent authenticates via keychain and successfully calls an LLM provider
2. **Verify credential lifecycle**: Login -> call LLM -> token expires -> auto-refresh -> call LLM again
3. **Verify config round-trip**: Config saved in Phase 0 config system correctly drives provider selection in Phase 2

**Acceptance:**
- A single script can: load config, retrieve credentials from keychain, instantiate a provider, send a message, receive a streamed response
- Token refresh works transparently during the test
- Config changes (e.g., switching default model) take effect without restart

---

### Phase 3: Agent Runtime

**Goal:** tmux-isolated agent sessions with lifecycle management and message queue.

**Complexity:** HIGH (9-12 days) -- BackgroundManager imports non-portable dependencies (`PluginInput`, `MESSAGE_STORAGE`); requires rewrite, not just adaptation

**Steps:**
1. **Extract tmux lifecycle and concurrency patterns, rewrite task dispatch** against AgentFlow's own agent registry:
   - Do NOT attempt to "adapt" BackgroundManager's 1382 lines wholesale
   - **Extract**: tmux session create/destroy/attach patterns, task state machine, concurrency limiting logic
   - **Rewrite**: task dispatch to use AgentFlow's `AgentConfig` from `src/types/`, not `PluginInput` from `@opencode-ai/plugin`
   - **Replace**: `MESSAGE_STORAGE` references with AgentFlow's file-based queue (`src/agent/messaging.ts`)
   - Port `concurrency.ts` ConcurrencyManager for per-model/provider limits
   - Target: `src/agent/tmux-manager.ts`

2. **Port agent registry** from `oh-my-claudecode/src/agents/definitions.ts`:
   - Uses `AgentConfig` type from `src/types/` (name, description, prompt, model, provider, namespace)
   - Port agent definition pattern (loadable prompts, model tiers)
   - Default agents: `planner`, `coder`, `reviewer`, `qa`, `security`
   - Target: `src/agent/registry.ts`

3. **Port team engine primitives** from `oh-my-claudecode/src/team/`:
   - `inbox-outbox.ts` -> `src/agent/messaging.ts` (inter-agent messaging)
   - `heartbeat.ts` -> `src/agent/heartbeat.ts` (agent liveness detection, uses `HeartbeatPayload` from `src/types/`)
   - `task-file-ops.ts` -> `src/agent/tasks.ts` (task CRUD, uses `TaskState` from `src/types/`)
   - `dispatch-queue.ts` -> `src/agent/dispatch.ts` (task queuing)
   - `tmux-session.ts` -> integrate into `tmux-manager.ts`
   - Strip MCP bridge specifics, keep file-based communication

4. **Implement broadcast queue** (race-condition-free design):
   - File: `.agent-cli/queue/broadcast.jsonl` (append-only, safe for concurrent writes)
   - Format: `{"id": uuid, "from": agent|user, "message": string, "timestamp": iso}`
   - **No `read_by` array** -- this creates a race condition on shared mutable state
   - Instead: per-agent pointer files at `.agent-cli/queue/pointers/{agent-name}.offset`
   - Each pointer file stores the last-read JSONL byte offset
   - Each agent reads broadcast.jsonl from its own offset forward -- no shared mutable state
   - Agents poll on task completion (not continuous polling)
   - TODO: Add rotation when all agent offsets advance past 10MB threshold — rotate to `broadcast.{n}.jsonl`, update pointer files atomically
   - Target: `src/agent/broadcast.ts`

5. **Port agent execution loop** from `claude-code/src/tools/AgentTool/runAgent.ts`:
   - Adapt the query loop (message -> LLM -> tool use -> repeat)
   - Strip claude-code-specific imports (bun:bundle features, analytics, MCP)
   - Wire to our provider layer instead of claude-code's query system
   - Target: `src/agent/execution.ts`

**Acceptance:**
- AC-10 passes (each agent in isolated tmux session)
- AC-12 passes (broadcast queue works)
- Agents can be created, started, stopped, and restarted
- Heartbeat detects dead agents within 30 seconds
- Message passing between agents works via inbox/outbox
- Broadcast read uses per-agent offset pointers, no shared mutable `read_by` array

**Source references:**
- `oh-my-opencode/src/features/background-agent/manager.ts` (BackgroundManager -- extract patterns only, do not port wholesale)
- `oh-my-opencode/src/features/background-agent/concurrency.ts` (ConcurrencyManager)
- `oh-my-claudecode/src/agents/definitions.ts` (AgentConfig, registry)
- `oh-my-claudecode/src/team/inbox-outbox.ts` (messaging)
- `oh-my-claudecode/src/team/heartbeat.ts` (liveness)
- `oh-my-claudecode/src/team/task-file-ops.ts` (task CRUD)
- `oh-my-claudecode/src/team/dispatch-queue.ts` (queuing)
- `oh-my-claudecode/src/team/tmux-session.ts` (tmux primitives)
- `claude-code/src/tools/AgentTool/runAgent.ts` (agent execution loop)

---

### Phase 4: k9s-Style TUI

**Goal:** React/Ink terminal dashboard with live agent monitoring.

**Complexity:** MEDIUM (5-7 days) -- React/Ink is well-documented; requires Phase 0 Ink+Bun spike to pass first

**Steps:**

**4a: TUI shell with typed mock data** (can begin before Phase 5 is ready):

1. **Set up React/Ink framework**:
   - Install `ink`, `ink-table`, `ink-text-input`, `react`
   - Create app shell with full-screen layout
   - Uses `AgentStatus`, `AgentConfig`, `HeartbeatPayload` from `src/types/`
   - Target: `src/tui/App.tsx`

2. **Implement agent table view** (with mock data initially):
   - Columns: NAME, STATUS (Running/Idle/Error/Stopped), TASK (current task summary), PROVIDER (claude/gemini/openai), NAMESPACE
   - Color coding: green=running, yellow=idle, red=error, gray=stopped
   - Sort by status (running first), then name
   - Mock data layer using shared types from `src/types/` for development
   - Target: `src/tui/components/AgentTable.tsx`

3. **Implement namespace filter**:
   - `:ns <name>` command filters table to agents in that namespace
   - `:ns all` shows all agents
   - Tab completion for namespace names
   - Target: `src/tui/components/NamespaceFilter.tsx`

4. **Implement agent detail pane**:
   - Enter on agent row opens split view
   - Shows tmux pane content (agent's thinking stream) via `tmux capture-pane`
   - Escape returns to table view
   - Target: `src/tui/components/AgentDetail.tsx`

5. **Implement command bar**:
   - Bottom bar for natural language input
   - `:` prefix for commands (`:ns`, `:quit`, `:help`)
   - No prefix = natural language task (sent to orchestrator)
   - `@agent-name` prefix = manual routing
   - Target: `src/tui/components/CommandBar.tsx`

6. **Implement status bar**:
   - Top bar: AgentFlow version, connected providers count, total agents, active tasks
   - Target: `src/tui/components/StatusBar.tsx`

**4b: Wire TUI to live agent runtime** (after Phase 5 orchestrator is ready):

7. **Replace mock data with live agent status** from Phase 3 heartbeat system
8. **Wire command bar input** to Phase 5 orchestrator for task dispatch
9. **Live update** via polling agent heartbeats (1s interval)

**Acceptance:**
- AC-1, AC-2, AC-3, AC-4, AC-5 pass
- TUI renders correctly in standard terminal (80x24 minimum)
- Resize handling works
- Keyboard navigation (arrow keys, enter, escape) works
- No flickering or layout thrashing during updates
- 4a can be demoed with mock data before Phase 5 is complete

**Source references:**
- `claude-code/src/tools/AgentTool/UI.tsx` (Ink agent display patterns)
- `claude-code/src/tools/AgentTool/agentDisplay.ts` (agent display formatting)

---

### Phase 5: Task Orchestrator

**Goal:** Automatic and manual task distribution across agents.

**Complexity:** MEDIUM (3-5 days) -- builds on Phase 3+4

**Steps:**
1. **Implement auto-distribution engine**:
   - Task analysis: classify incoming task (code, review, plan, test, security)
   - Agent matching: find best idle agent by category capability + provider availability
   - Port allocation logic from `oh-my-claudecode/src/team/allocation-policy.ts`
   - Port category routing from `oh-my-opencode/src/tools/delegate-task/constants.ts`
   - Target: `src/orchestrator/distributor.ts`

2. **Implement manual override**:
   - Parse `@agent-name task description` syntax from command bar
   - Validate agent exists and is available
   - Queue task to specific agent, skip auto-distribution
   - Target: `src/orchestrator/manual.ts`

3. **Implement task lifecycle**:
   - States: PENDING -> ASSIGNED -> RUNNING -> COMPLETED | FAILED | CANCELLED (uses `TaskState` from `src/types/`)
   - Task persistence: `.agent-cli/tasks/` directory, one JSON per task
   - Task history: completed tasks archived to `.agent-cli/history/`
   - Target: `src/orchestrator/lifecycle.ts`

4. **Implement credential pre-flight**:
   - Before assigning a task, call `AuthRegistry.isValid(providerId)`
   - If expired, attempt refresh
   - If refresh fails, reassign task to agent with a different provider or surface TUI error
   - Target: `src/orchestrator/preflight.ts`

5. **Wire to TUI** (completes Phase 4b):
   - Command bar input -> orchestrator -> agent assignment -> TUI status update
   - Task status visible in TASK column
   - Target: integration in `src/tui/App.tsx`

**Acceptance:**
- AC-5, AC-6 pass
- Auto-distribution selects appropriate agent based on task type
- Manual override `@agent-name` works
- Task state transitions are visible in TUI in real time
- Failed tasks are retried or surfaced to user
- Expired credentials are refreshed or task is reassigned before dispatch

**Source references:**
- `oh-my-claudecode/src/team/allocation-policy.ts` (allocation logic)
- `oh-my-opencode/src/tools/delegate-task/tools.ts` (category routing, model selection)
- `oh-my-opencode/src/tools/delegate-task/constants.ts` (category definitions)
- `claude-code/src/coordinator/coordinatorMode.ts` (coordinator patterns)

---

### Phase 6: Dev Pipeline

**Goal:** Fully automated branch -> plan -> work -> review -> QA -> PR pipeline.

**Complexity:** MEDIUM (5-7 days)

**Steps:**
1. **Implement pipeline orchestrator**:
   - Pipeline definition: ordered list of stages with agent assignments
   - Default pipeline: `[branch-create, plan, implement, security-review, code-review, qa-test, pr-create]`
   - Each stage = task assigned to appropriate agent
   - Stage gating: next stage only starts when current stage passes
   - Target: `src/pipeline/orchestrator.ts`

2. **Implement stage agents**:
   - `branch-create`: git checkout -b, naming convention
   - `plan`: planner agent creates implementation plan
   - `implement`: coder agent(s) execute the plan
   - `security-review`: security agent scans for vulnerabilities
   - `code-review`: reviewer agent checks code quality
   - `qa-test`: QA agent runs tests, verifies acceptance criteria
   - `pr-create`: creates PR with summary from all stages
   - Target: `src/pipeline/stages/`

3. **Implement pipeline CLI**:
   - `agentflow pipeline start "feature description"` -> kicks off full pipeline
   - `agentflow pipeline status` -> shows current pipeline stage
   - `agentflow pipeline cancel` -> aborts pipeline
   - Target: `src/cli/pipeline.ts`

4. **Wire PR gates**:
   - PR requires: security-reviewer approval + code-reviewer approval + QA pass
   - Gate results stored in `.agent-cli/pipeline/{id}/gates/`
   - Target: `src/pipeline/gates.ts`

**Acceptance:**
- AC-15, AC-16 pass
- Pipeline runs end-to-end for a simple feature request
- Each stage produces artifacts visible in `.agent-cli/pipeline/`
- Failed gates block progression with clear error messages

**Source references:**
- `oh-my-claudecode/src/team/phase-controller.ts` (phase sequencing)
- `oh-my-claudecode/src/team/governance.ts` (approval gates)
- `oh-my-claudecode/src/team/merge-coordinator.ts` (merge coordination)

---

### Phase 7: Security Audit and Gitignore

**Goal:** Security hardening and auto-gitignore (config system already exists from Phase 0).

**Complexity:** LOW (1-2 days) -- config is done in Phase 0; this phase is just security + gitignore

**Steps:**
1. **Implement gitignore auto-management**:
   - On init: check `.gitignore` exists, add `claude/` and `.agent-cli/queue/` if missing
   - Use `claude/` not `./claude/` -- git does not recognize the `./` prefix
   - On every agent start: verify gitignore entries still present
   - Target: `src/config/gitignore.ts`

2. **Audit credential security**:
   - Verify no credentials written to disk outside keychain
   - Verify `.agent-cli/` sensitive subdirectories are gitignored
   - Add runtime check: if plaintext credential detected in workspace, warn and delete
   - Target: `src/config/security-audit.ts`

**Acceptance:**
- AC-11, AC-13, AC-20 pass
- `.gitignore` auto-managed correctly with `claude/` (not `./claude/`)
- No credentials in plaintext on disk (verified by security audit)

---

### Phase 8: Install and Distribution

**Goal:** Easy installation and npm distribution.

**Complexity:** LOW (2-3 days)

**Steps:**
1. **Implement setup wizard**:
   - `agentflow install` runs interactive setup
   - Step 1: Check tmux installed (`which tmux`), offer install command if missing
   - Step 2: Auth setup (guide through provider auth flows)
   - Step 3: Agent configuration (default agents, custom agents, namespaces)
   - Step 4: Verify setup (launch test agent, confirm connectivity)
   - Target: `src/cli/install.ts`

2. **Configure Bun compile**:
   - `bun build --compile --minify src/cli/index.ts --outfile dist/agentflow`
   - Verify no native addons block compilation (keytar removed in Phase 1)
   - Test binary on macOS and Linux
   - Target: `package.json` scripts

3. **Configure npm publish**:
   - `package.json`: name=`agentflow-cli`, bin=`agentflow`, files=`dist`
   - README with installation instructions
   - `prepublishOnly` script runs build
   - Note: Reconcile npm bin path (`./dist/index.js`) with compiled binary path (`dist/agentflow`) — update package.json bin entry to match Phase 8 output
   - Target: `package.json`

4. **Add CI/CD** (GitHub Actions):
   - Test on push (bun test)
   - Build binary on release tag
   - Publish to npm on release tag
   - Target: `.github/workflows/`

**Acceptance:**
- AC-17, AC-18, AC-19 pass
- `agentflow install` works on fresh machine (with tmux)
- Binary runs without Bun installed
- npm package installs and runs correctly

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Vercel AI SDK doesn't support all tool-use patterns for all providers | HIGH | MEDIUM | Build thin adapter layer on top; fall back to direct SDK for edge cases |
| tmux not available on target machine | HIGH | LOW | `agentflow install` checks for tmux; provide install instructions; consider iTerm2 fallback on macOS |
| Claude OAuth token expiry during long pipelines | MEDIUM | HIGH | Implement automatic token refresh in auth layer; refresh 5 min before expiry; credential pre-flight in orchestrator |
| Ink/React rendering incompatibility with Bun | MEDIUM | MEDIUM | Phase 0 spike validates Ink+Bun before committing; fallback to blessed/neo-blessed if spike fails. Note: fallback to blessed/neo-blessed requires full Phase 4 rewrite (~3-5 additional days; reflected in total buffer) |
| Effect-TS rewrite scope larger than estimated | HIGH | MEDIUM | Phase 2 elevated to HIGH (7-10 days); port only SDK factory calls (~200 lines), rewrite everything else from scratch |
| BackgroundManager non-portable dependencies | HIGH | HIGH | Phase 3 elevated to HIGH (9-12 days); extract patterns only, rewrite dispatch against AgentFlow's own registry |
| File-based queue corruption on concurrent writes | MEDIUM | LOW | Broadcast JSONL is append-only; per-agent offset pointers eliminate shared mutable state |
| Bun compile compatibility issues | MEDIUM | MEDIUM | No native addons (keytar removed); test binary on CI across macOS arm64, macOS x64, Linux x64 |

---

## Verification Steps

### Per-Phase Verification

1. **Phase 0**: `bun run build && bun run dev --help` succeeds; shared types compile; config round-trips; Ink spike renders
2. **Phase 1**: `bun test src/auth/` passes; manual test of OAuth flow against real Claude API; keychain works on macOS and Linux
3. **Phase 2**: Integration test sending "hello" to each provider and getting a response; no Effect-TS imports in `src/provider/`
4. **Phase 2.5**: End-to-end auth -> provider -> LLM call succeeds with auto-refresh
5. **Phase 3**: Spawn 3 agents in tmux, verify isolation, send broadcast, verify all receive via offset pointers
6. **Phase 4a**: TUI renders with mock data; keyboard navigation works
7. **Phase 4b + Phase 5**: Submit task via command bar, verify auto-distribution selects correct agent; credential pre-flight works
8. **Phase 6**: Run pipeline on a trivial feature ("add a hello world endpoint"), verify all stages complete
9. **Phase 7**: Grep workspace for plaintext credentials; verify `.gitignore` contains `claude/` not `./claude/`
10. **Phase 8**: `bun build --compile`, run binary, verify all commands work; `npm pack` and install from tarball

### End-to-End Verification

- Fresh machine setup: `npm install -g agentflow-cli && agentflow install && agentflow`
- Full pipeline: natural language request -> agents work -> PR created
- Multi-provider: one task uses Claude, another uses Gemini simultaneously

---

## ADR: Provider Architecture Decision

### Decision
Use Vercel AI SDK provider abstraction ported from OpenCode as the unified provider layer. Port only the SDK factory calls; rewrite registry, model resolution, and DI in plain TypeScript.

### Drivers
1. Must support Claude, Gemini, OpenAI simultaneously with a single interface
2. Must support streaming and tool-use across all providers
3. Must be extensible for future providers without core changes

### Alternatives Considered
1. **Direct SDK integration**: Use each provider's native SDK directly. Rejected because it creates N*M integration matrix and loses OpenCode's proven model resolution/fallback.
2. **LangChain.js**: Use LangChain's provider abstraction. Rejected because it adds massive dependency (~50MB), has complex chain abstractions we don't need, and doesn't align with our lightweight local-first principle.
3. **Custom abstraction from scratch**: Build our own thin adapter. Rejected because it duplicates 6+ months of Vercel AI SDK ecosystem work for no clear benefit.
4. **Keep Effect-TS as a dependency**: Keep OpenCode's Effect-TS-based provider layer largely intact. Rejected because it adds 1MB+ to bundle, forces the team to learn Effect-TS paradigm, and contaminates the codebase philosophy of local-first simplicity.

### Why Chosen
Vercel AI SDK is already proven in OpenCode with 20+ provider integrations. The SDK factory calls (~200 lines) are the actual value; the Effect-TS DI/registry layer around them is not portable. Active ecosystem means new providers get added upstream. Tool-use and streaming protocols are standardized.

### Consequences
- Dependency on `ai` and `@ai-sdk/*` packages (~2MB)
- Must maintain compatibility with Vercel AI SDK major version upgrades
- Effect-TS schemas from OpenCode must be replaced with Zod or plain union types during port
- "Port, Don't Rewrite" principle is softened to "Port algorithms, rewrite integration glue" for Phases 2-3 where source code is deeply entangled with Effect-TS or foreign plugin systems

### Follow-ups
- Evaluate dropping unused providers (keep only anthropic, google, openai initially)
- Monitor Vercel AI SDK v4 roadmap for breaking changes
- Consider contributing AgentFlow-specific provider improvements upstream
- **Validate Ink + Bun compatibility in Phase 0 spike before committing to React/Ink TUI approach**

---

## Open Questions

See `.omc/plans/open-questions.md` for tracked items.

---

## Estimated Complexity

- **Phase 0**: MEDIUM (3-5 days) -- now includes shared types, config system, Ink spike
- **Phase 1**: HIGH (5-7 days) -- OAuth PKCE + platform keychain CLI
- **Phase 2**: HIGH (7-10 days) -- 1735 lines / 98 Effect-TS constructs require rewrite, not strip
- **Phase 2.5**: LOW (1-2 days) -- integration checkpoint
- **Phase 3**: HIGH (9-12 days) -- BackgroundManager has non-portable deps; rewrite task dispatch
- **Phase 4**: MEDIUM (5-7 days) -- React/Ink, split into 4a (mock) + 4b (live wiring)
- **Phase 5**: MEDIUM (3-5 days) -- builds on Phase 3+4, adds credential pre-flight
- **Phase 6**: MEDIUM (5-7 days) -- pipeline logic + stage agents
- **Phase 7**: LOW (1-2 days) -- security audit + gitignore only (config moved to Phase 0)
- **Phase 8**: LOW (2-3 days) -- build + publish config

**Subtotal**: 41-60 days of focused development
**Cross-phase integration buffer**: 5-7 days (Phase 2.5, 4a/4b wiring, end-to-end testing)
**Total estimate**: 46-67 days of focused development

---

## Constraints

- **Bun runtime required**: All scripts and the compiled binary target Bun. Node.js is not a supported runtime.
- **tmux required**: Agent isolation depends on tmux sessions. Windows is not supported (no tmux).
- **Windows not supported at launch** — `security`/`secret-tool` keychain adapters are macOS/Linux only.
- **No native addons**: `bun build --compile` requires pure-JS/TS dependencies. Native addons (e.g., `keytar`) are explicitly excluded.
- **Local-first only**: No cloud orchestration server. All state lives on the user's machine under `.agent-cli/`.

---

## Changelog

- **Iteration 1**: 12 critical/major fixes applied (config→Phase 0, shared types, Effect-TS strategy, keytar removal, broadcast race fix, BackgroundManager rewrite, estimate corrections, test strategy, credential pre-flight, ADR expansion)
- **Iteration 2**: 6 minor improvements applied (Phase 0 estimate, Ink fallback cost note, Windows constraint, package.json bin path note, broadcast rotation TODO, total estimate update)
- **Status**: APPROVED by Critic (2 consensus iterations)
