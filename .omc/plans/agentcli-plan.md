# agentcli — Implementation Plan (Final)

**Spec:** `.omc/specs/deep-interview-agent-cli.md`  
**Generated:** 2026-04-14 | **Revised v2:** 2026-04-14 | **Final after Critic review:** 2026-04-14  
**Strategy:** Evolutionary rename + gap-fill of AgentFlow (brownfield)  
**Version target:** 0.2.0 → published as `agentcli` on npm

---

## RALPLAN-DR Summary

### Principles
1. **Brownfield evolution over greenfield rewrite** — AgentFlow provides ~70% of agentcli's surface; extend rather than restart.
2. **Additive integration** — Pull patterns from source repos (OMC, OpenCode) without full merges.
3. **Local-first, serverless by default** — All state on disk, OS keychain for secrets.
4. **Single-entry TUI** — `agentcli` with no subcommand launches the k9s-style dashboard immediately.
5. **Spec-driven gap-fill** — Only implement what the 19 spec acceptance criteria require, verified against HEAD.
6. **Identity layer before rename** — Extract brand constants before flipping them; rename is atomic and grep-auditable.

### Decision Drivers
1. **19 spec acceptance criteria** — Every criterion is a concrete pass/fail test; plan addresses each explicitly.
2. **Minimal regression risk** — Re-use existing, working code; new code only for true gaps confirmed against HEAD.
3. **npm name availability** — Must verify `agentcli` on npm as a prerequisite gate before any rename work begins.

### Viable Options

**Option A (Selected): Evolutionary rename + gap-fill with identity layer**  
Pre-step: extract `src/branding.ts` constants (`APP_NAME`, `TMUX_PREFIX`, etc.). Replace all hardcoded strings via grep. Flip constants atomically. Fill 4 true gaps (G1, G5, G6, G6b). Verify + tune 3 misclassified gaps (G2/G3/G4 already implemented).  
*Pros:* Low risk, fast, all existing OAuth/tmux/model fixes carry forward. Rename is reviewable and reversible.  
*Cons:* Two binary names during one-minor transition period; requires full blast-radius grep.

**Option B: Fork Claude Code as base, integrate AgentFlow features**  
*Invalidated:* CC's architecture targets interactive assistant mode, not multi-agent orchestration. 4-6x work, high regression risk, no spec-mandated benefit at this stage.

**Option C: Keep `agentflow` name, publish `agentflow-cli`**  
*Invalidated:* Violates spec's explicit `agentcli` package name requirement.

---

## Requirements Summary

agentcli is a **unified, serverless, local-first multi-agent CLI orchestrator** that:
- Launches a k9s-style TUI showing 5+ agents (NAME / STATUS / TASK / PROVIDER / NAMESPACE)
- Lets users type task instructions in a command bar, auto-routes to best agent
- Supports `@agent-name` manual routing and `공지!` / `/broadcast` for announcements
- Runs each agent as an isolated tmux session (`agentcli-<name>`)
- Stores credentials in OS keychain (macOS `security` CLI); never in plaintext config
- Automates the full dev pipeline: task → git branch → plan markdown → implement → security review → code review → QA → PR (via `gh pr create`; blocked by gate failures)
- Stores plans at `./claude/Plans/<branch>.md` (local-only, gitignored)
- Published to npm as `agentcli`, installable via `npm install -g agentcli`

---

## Gap Analysis (Verified Against HEAD — AgentFlow 0.1.2)

### True Gaps (require implementation)

| # | Gap | Evidence | Required |
|---|-----|----------|----------|
| G1 | Package / command rename | `package.json`: `name=agentflow-cli`, `bin=agentflow`, `outfile dist/agentflow` | `agentcli`, `agentcli` binary, `dist/agentcli` |
| G5 | `agentcli task` and `agentcli dispatch` commands | Only `agentflow pipeline start "..."` in CLI | Two top-level commands: `task` (full pipeline) and `dispatch` (direct assignment) |
| G6 | Plan markdown at `./claude/Plans/<branch>.md` | `src/pipeline/orchestrator.ts:43-104` writes only `pipeline.json`; no markdown generated | `generatePlanMarkdown()` + write to `./claude/Plans/<branch>.md` |
| G6b | Real `gh pr create` call | `src/pipeline/orchestrator.ts:97` — `console.log('[pipeline] Would create PR...')` stub | Actual `gh pr create` invocation with gate-blocking check |

### Previously Misclassified as Gaps (already implemented — verify + tune only)

| # | "Gap" | Actual State | Action |
|---|-------|--------------|--------|
| G2 | TUI: Enter → live tmux stream | `AgentDetail.tsx:19-41` — `captureTmuxPane`, `useEffect`+`setInterval`, cleanup on unmount. Refresh=2000ms (need 500ms), lines=20 (need 50) | Tune `AgentDetail.tsx:35,39` only |
| G3 | `config set-prompt` command | `src/cli/config-cmd.ts:39-55` — fully implemented; `saveConfig` at `src/config/index.ts:43-50` | Verify + add regression test |
| G4 | `/broadcast` alias | `src/orchestrator/manual.ts:34-37` — both `공지!` and `/broadcast ` routed to broadcast | Verify + add regression test |

### Pre-existing Partial Coverage (not claimed by plan, out of scope)

- Gate-blocking logic in `startPipeline()` — AC14 says "on gate pass". Current `src/pipeline/orchestrator.ts:85` records gate result as `'pending'` and proceeds unconditionally. G6b fix adds real `gh pr create` but full gate-blocking is an explicit follow-up item (noted in ADR, not scoped to v0.2.0). Workaround: fail PR step if any gate result is not `'passed'`.

### Rename Blast-Radius (complete — from grep + architect + critic review)

All sites must be replaced via grep before Step 1 is merged. Do NOT use the partial list as exhaustive:

```bash
grep -rn "agentflow" src/ bin/ package.json --include="*.ts" --include="*.tsx" --include="*.json" --include="*.js"
```

Known confirmed sites (not exhaustive — treat grep as authoritative):
- `src/tui/components/AgentDetail.tsx:21` — `` `agentflow-${agent.name}` ``
- `src/cli/agents.ts:131,133,178,213,235` — tmux prefix in user-facing commands + help text
- `src/cli/worker.ts:30,44,49,53,61,74` — `[agentflow-worker]` log prefix
- `src/cli/auth.ts:118-119,136` — help text referencing `agentflow auth ...`
- `src/utils/logger.ts:7-8` — log file name and env var `AGENTFLOW_DEV` (breaking rename → `AGENTCLI_DEV`)
- `src/cli/index.ts` — `program.name()` call
- `bin/agentflow` — the shim file itself
- `package.json` — name, bin, scripts.build

---

## Acceptance Criteria (Testable — 19 spec criteria + 1 derived)

*Note: spec has 19 bulleted criteria. AC20 is derived from the keychain security requirement stated in the spec but not numbered separately.*

| AC | Criterion | Specific Test |
|----|-----------|---------------|
| AC1 | `agentcli` launches TUI immediately | `agentcli` with no args; TUI renders agent table within 2s |
| AC2 | TUI: NAME, STATUS, TASK, PROVIDER, NAMESPACE columns visible | All 5 column headers visible in `AgentTable` without scrolling |
| AC3 | Namespace filtering works | Press `n`; filter prompt appears; select `core`; only planner/coder/architect/executor/explorer visible |
| AC4 | Enter on agent → tmux stream (50 lines, 500ms refresh) | Press Enter on agent row; detail panel shows 50 lines, updates within 500ms |
| AC5 | Command bar: natural language task input | Type task in command bar; press Enter; `agentcli tasks list` shows new task with state `pending` |
| AC6 | Auto-distribution to best idle agent | Submit a `"write tests for X"` task; it routes to `qa` agent (task type = test) |
| AC7 | `@agent-name` manual override | Input `@coder implement foo`; task assigned to `coder` specifically, not auto-routed |
| AC8 | `agentcli config set-prompt` persists | `agentcli config set-prompt coder "Be terse"`; `cat .agent-cli/config.json \| jq '.agents[] \| select(.name=="coder") \| .prompt'` → `"Be terse"` |
| AC9 | Broadcast: both `공지!` and `/broadcast` work | Send each prefix; `cat .agent-cli/queue/broadcast.jsonl` has entry for both |
| AC10 | Broadcast queue at `.agent-cli/queue/broadcast.jsonl` | File exists and is appended after each broadcast; entries are valid JSON |
| AC11 | `agentcli auth login` → Claude OAuth | Browser opens; token stored; `agentcli auth status` shows `claude: authenticated` |
| AC12 | `agentcli auth add --provider gemini` → Gemini OAuth | Gemini OAuth completes; token in keychain; `agentcli auth status` shows `gemini: authenticated` |
| AC13 | `agentcli auth add --provider openai --key sk-xxx` → keychain | `security find-generic-password -s agentcli -a openai-key 2>/dev/null` returns success |
| AC14 | `agentcli task "..."` → full pipeline incl. real PR | Branch created; `./claude/Plans/<branch>.md` exists; all gates pass; `gh pr list` shows new PR |
| AC15 | `./claude/` gitignored | `cat .gitignore \| grep 'claude/'` → match present after `agentcli install` |
| AC16 | `agentcli install` sets up from scratch | tmux present; auth prompted; `.agent-cli/` dirs created; `.gitignore` updated; `gh` binary check passes |
| AC17 | Each agent as isolated tmux session `agentcli-<name>` | `agentcli agents start-all && tmux ls \| grep agentcli-` → 5+ sessions named `agentcli-<name>` |
| AC18 | `agentcli agents list` shows all agents | Table shows name, status, provider, namespace for all registered agents |
| AC19 | `agentcli agents add --name foo --provider claude --namespace backend` | Agent appears in `agentcli agents list`; `agentcli agents start foo` starts tmux session |
| AC20 | API keys never in plaintext config | `cat .agent-cli/config.json \| grep 'sk-'` → no matches |

---

## Implementation Steps

### Step 0 — PREREQUISITE: Verify npm name and `gh` CLI availability

```bash
# Check npm name
npm view agentcli 2>&1 | head -5
# → "npm error 404 Not Found" means available; proceed
# → Any other output: pivot to @hitbee/agentcli; update package.json and bin/ paths

# Check gh CLI (required for AC14)
gh --version 2>&1 || echo "MISSING: install gh CLI before proceeding"
```

**Do not start Step 1 until both checks pass.**

---

### Step 1 — Identity Layer: Extract Brand Constants + Full Rename (G1)
**Files:** `src/branding.ts` (new), all blast-radius sites from grep

1.1 Create `src/branding.ts`:
```typescript
export const BRAND = {
  APP_NAME: 'agentcli',
  BINARY_NAME: 'agentcli',
  TMUX_PREFIX: 'agentcli-',
  STATE_DIR: '.agent-cli',
  PLAN_DIR: 'claude/Plans',
  LOG_ENV_VAR: 'AGENTCLI_DEV',
} as const;
```

1.2 Run grep to find every blast-radius site:
```bash
grep -rn "agentflow" src/ bin/ --include="*.ts" --include="*.tsx" --include="*.js"
```
Replace each occurrence with the appropriate `BRAND.*` constant. Mapping guide:
- `agentflow-` (tmux prefix) → `` `${BRAND.TMUX_PREFIX}` ``
- `agentflow` (binary/program name in help text) → `BRAND.APP_NAME`
- `[agentflow-worker]` → `` `[${BRAND.APP_NAME}-worker]` ``
- `agentflow.log` (logger) → `` `${BRAND.APP_NAME}.log` ``
- `AGENTFLOW_DEV` (env var) → `BRAND.LOG_ENV_VAR`
- **Breaking change**: users with `AGENTFLOW_DEV=1` must switch to `AGENTCLI_DEV=1`; document in CLAUDE.md

1.3 `package.json`:
- `name`: `agentflow-cli` → `agentcli`
- `version`: `0.1.2` → `0.2.0`
- `bin`: `{ "agentcli": "bin/agentcli" }`
- `build` script: `--outfile dist/agentcli`
- `description`: update to reflect agentcli branding

1.4 Create `bin/agentcli`:
```javascript
#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const binary = path.join(__dirname, '..', 'dist', 'agentcli');
const proc = spawn(binary, process.argv.slice(2), { stdio: 'inherit' });
proc.on('exit', (code) => process.exit(code ?? 0));
```

1.5 Keep `bin/agentflow` as deprecated alias for v0.2.x; remove in v0.3.0. The alias prints a deprecation warning:
```javascript
// bin/agentflow — deprecated, points to same binary
#!/usr/bin/env node
console.error('Warning: agentflow is deprecated. Use agentcli instead.');
require('./agentcli');
```

1.6 After replacing all blast-radius sites, run grep again to confirm zero matches:
```bash
grep -rn "agentflow" src/ bin/agentcli --include="*.ts" --include="*.tsx" --include="*.js"
# Must return no output
```

**Acceptance criteria:** AC1, AC17 (tmux prefix), AC18, AC19

---

### Step 2 — TUI: Tune Live Tmux Streaming (G2 — tune only)
**Files:** `src/tui/components/AgentDetail.tsx:35,39`

Current in-process `Bun.spawnSync` approach is correct. Only two parameters need updating:

2.1 Line 35: `lines = 20` → `lines = 50`  
2.2 Line 39: `setInterval(..., 2000)` → `setInterval(..., 500)`

After Step 1 (BRAND constants), the tmux target at line 21 will reference `BRAND.TMUX_PREFIX` and AC4 + AC17 will be consistent.

**Acceptance criteria:** AC4

---

### Step 3 — Verify `config set-prompt` + Regression Tests (G3 — verify + test only)
**Files:** `src/cli/config-cmd.ts:39-55`

3.1 Manual verification:
```bash
agentcli config set-prompt coder "Be terse"
cat .agent-cli/config.json | jq '.agents[] | select(.name=="coder") | .prompt'
# → "Be terse"
agentcli config set-prompt nonexistent "x"
echo $?  # → 1 (error exit)
```

3.2 Add regression test. Check existing test file convention:
```bash
ls src/**/*.test.ts tests/ 2>/dev/null | head -5
```
Then add test in the appropriate location:
- `set-prompt <agentName> <prompt>` modifies correct agent prompt
- Unknown agent name exits with code 1
- `saveConfig` round-trips through Zod validation (no schema errors)

**Acceptance criteria:** AC8

---

### Step 4 — Verify `/broadcast` Alias + Regression Tests (G4 — verify + test only)
**Files:** `src/orchestrator/manual.ts:34-37`

4.1 Manual verification:
```bash
agentcli agents start coder  # need a running agent
# Then in TUI command bar: /broadcast hello world
cat .agent-cli/queue/broadcast.jsonl | tail -1  # → JSON entry with "hello world"
```

4.2 Add regression test for `parseCommand()`:
```typescript
expect(parseCommand('/broadcast hello')).toEqual({ type: 'system', command: 'broadcast hello' });
expect(parseCommand('공지! hello')).toEqual({ type: 'system', command: 'broadcast hello' });
expect(parseCommand('@coder fix bug')).toEqual({ type: 'manual', agentName: 'coder', task: 'fix bug' });
```

**Acceptance criteria:** AC9, AC10

---

### Step 5 — `agentcli task` and `agentcli dispatch` Commands (G5)
**Files:** `src/cli/index.ts`

5.1 Add `task` command (full automated pipeline):
```typescript
import { BRAND } from '../branding.ts';

program
  .command('task <description>')
  .description('Submit a task through the full automated pipeline (branch → plan → implement → review → QA → PR)')
  .option('--no-pr', 'Skip PR creation (run pipeline up to QA only)')
  .action(async (description: string, options) => {
    await preflightCheck();
    const pipeline = await startPipeline(description, { skipPR: !options.pr });
    console.log(`Pipeline started: ${pipeline.id}`);
    console.log(`Branch:           ${pipeline.branch}`);
    console.log(`Plan:             ./${BRAND.PLAN_DIR}/${pipeline.branch}.md`);
    console.log(`\nMonitor: agentcli pipeline status ${pipeline.id}`);
  });
```

5.2 Add `dispatch` command (direct assignment, no pipeline):
```typescript
program
  .command('dispatch <description>')
  .description('Dispatch a task directly to a specific agent (no pipeline, no branch)')
  .requiredOption('--agent <name>', 'Target agent name')
  .action(async (description: string, options) => {
    await preflightCheck();
    // Correct positional signature: submitTask(description, agentName?)
    await submitTask(description, options.agent);
    console.log(`Task dispatched to ${options.agent}`);
  });
```

5.3 Add `pipeline status <id>` subcommand:
```typescript
program
  .command('pipeline status <id>')
  .description('Show progress of a pipeline')
  .action(async (id: string) => {
    const status = await getPipelineStatus(id);
    console.log(JSON.stringify(status, null, 2));
  });
```

**Acceptance criteria:** AC5, AC6, AC7, AC14

---

### Step 6 — Plans at `./claude/Plans/` + Real PR Creation (G6, G6b)
**Files:** `src/pipeline/orchestrator.ts`

6.1 Import branding and add plan markdown generation:
```typescript
import { BRAND } from '../branding.ts';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

function generatePlanMarkdown(description: string, branch: string, pipelineId: string): string {
  return `# Plan: ${branch}\n\n**Task:** ${description}\n**Pipeline:** ${pipelineId}\n**Created:** ${new Date().toISOString()}\n\n## Stages\n- [ ] branch-create\n- [ ] implement\n- [ ] review\n- [ ] security\n- [ ] qa\n- [ ] pr\n`;
}
```

6.2 In `startPipeline()`, after branch creation, write plan markdown:
```typescript
const planDir = path.join(process.cwd(), BRAND.PLAN_DIR);
await mkdir(planDir, { recursive: true });
const planPath = path.join(planDir, `${branch}.md`);
await writeFile(planPath, generatePlanMarkdown(description, branch, pipeline.id));
```

6.3 **Fix the PR creation stub** (line 97): replace `console.log` with real `gh pr create`:
```typescript
async function createPR(branch: string, title: string, body: string): Promise<string> {
  const result = Bun.spawnSync(
    ['gh', 'pr', 'create', '--title', title, '--body', body, '--head', branch],
    { stderr: 'pipe', stdout: 'pipe' }
  );
  const output = new TextDecoder().decode(result.stdout).trim();
  if (result.exitCode !== 0) {
    const err = new TextDecoder().decode(result.stderr).trim();
    throw new Error(`gh pr create failed: ${err}`);
  }
  return output; // PR URL
}
// Note: Bun is a global; no import needed
```

6.4 Add gate-blocking check before PR creation:
```typescript
// Before calling createPR:
const gateResults = pipeline.stages
  .filter(s => ['review', 'security', 'qa'].includes(s.name))
  .map(s => s.gateResult);
if (gateResults.some(r => r !== 'passed')) {
  console.error('PR blocked: not all gates passed. Run: agentcli pipeline status ' + pipeline.id);
  return;
}
```

6.5 `src/config/gitignore.ts` — the existing `ensureGitignore()` (no-arg) already has a `REQUIRED_ENTRIES` constant. Verify it includes `claude/` and `.agent-cli/`:
```bash
grep -A10 'REQUIRED_ENTRIES' src/config/gitignore.ts
```
If `claude/` is missing from `REQUIRED_ENTRIES`, add it there. Do NOT change the call signature.

6.6 **Note:** `./claude/Plans/` (no dot) is intentionally distinct from `.claude/` (Claude Code/OMC config). The gitignore entry `claude/` matches only the non-dotted directory. `.claude/` is not affected.

**Acceptance criteria:** AC14, AC15, AC16

---

### Step 7 — Agent Registry Expansion + COMPLETION_SIGNAL Retrofit (G1 complement)
**Files:** `src/agent/registry.ts`

7.1 Add `COMPLETION_SIGNAL` constant and retrofit ALL existing agents:
```typescript
// src/agent/registry.ts (top-level constant)
const COMPLETION_SIGNAL = '\n\nWhen you have fully completed the task, end your final response with exactly: TASK COMPLETE';

// Update all existing agent prompts to append COMPLETION_SIGNAL
// (planner, coder, reviewer, security, qa — verify each currently ends with the hardcoded string)
// Replace inline strings with: `${existingPrompt}${COMPLETION_SIGNAL}`
```

7.2 Add 3 new agents:
```typescript
{
  name: 'architect',
  namespace: 'core',
  model: 'claude-opus-4-6',
  description: 'Strategic architecture and system design',
  prompt: `You are a software architect. Analyze system design, evaluate trade-offs, and produce architectural decision records.${COMPLETION_SIGNAL}`,
},
{
  name: 'executor',
  namespace: 'core',
  model: 'claude-sonnet-4-6',
  description: 'Focused implementation executor',
  prompt: `You are a focused implementation executor. Complete specific, well-defined coding tasks with precision and minimal scope creep.${COMPLETION_SIGNAL}`,
},
{
  name: 'explorer',
  namespace: 'core',
  model: 'claude-haiku-4-5-20251001',
  description: 'Fast codebase search and analysis',
  prompt: `You are a codebase explorer. Search files, find patterns, and answer factual questions about the repository structure.${COMPLETION_SIGNAL}`,
},
```

7.3 Update `src/orchestrator/distributor.ts` — route `explore/search/find` tasks to `explorer`:
```typescript
// In classifyTask() or equivalent routing function:
if (/\b(explore|search|find|look for|locate|where is)\b/i.test(description)) {
  return 'explore';  // task type
}

// In findBestAgent() routing map:
case 'explore': return agents.find(a => a.name === 'explorer') ?? fallbackAgent;
```

**Note:** `claude-sonnet-4-6` and `claude-opus-4-6` route through `claude` CLI subprocess per CLAUDE.md item 7. The `claude` binary must be on PATH. Add to `agentcli install` preflight:
```typescript
const claudeCheck = Bun.spawnSync(['which', 'claude'], { stderr: 'ignore' });
if (claudeCheck.exitCode !== 0) {
  console.warn('Warning: claude CLI not found. Sonnet/Opus models unavailable until installed.');
}
```

**Acceptance criteria:** AC18, AC19

---

### Step 8 — Build, Install, Publish

8.1 Build:
```bash
bun run build  # → dist/agentcli (no --minify, per CLAUDE.md item 4)
```

8.2 Local install (clean):
```bash
rm ~/.local/bin/agentcli 2>/dev/null
cp dist/agentcli ~/.local/bin/agentcli
agentcli --version  # → 0.2.0
```

8.3 Update `CLAUDE.md`:
- Add: branding constants at `src/branding.ts`
- Add: `AGENTFLOW_DEV` → `AGENTCLI_DEV` env var rename (breaking)
- Add: `./claude/Plans/` plan dir distinction from `.claude/`
- Add: `agentcli task` and `agentcli dispatch` commands
- Add: `claude` binary required for Sonnet/Opus models

8.4 Deprecate old npm package:
```bash
npm deprecate agentflow-cli@* "Deprecated: use agentcli instead"
```

8.5 Publish new package:
```bash
npm publish --access public  # publishes agentcli@0.2.0
```

8.6 Migrate instructions for existing `agentflow` users:
```
npm uninstall -g agentflow-cli
npm install -g agentcli
tmux kill-server  # removes old agentflow-<name> sessions
agentcli install  # creates new agentcli-<name> sessions
```

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `agentcli` npm name taken | Medium | **BLOCKER** | Step 0 prerequisite gate; pivot to `@hitbee/agentcli` |
| `gh` CLI not installed | Medium | High | `agentcli install` checks for `gh`; error with install URL if missing |
| `claude` CLI not installed | Medium | Medium | `agentcli install` warns but doesn't block; Haiku works without it |
| Grep misses blast-radius site | Medium | Medium | Run verify-grep after Step 1; CI lint for `agentflow` string |
| `AGENTFLOW_DEV` rename breaks user workflows | Low | Low | Document in CLAUDE.md; deprecated alias in `bin/agentflow` warns |
| `./claude/Plans/` not gitignored in existing repos | Medium | Low | `agentcli install` updates `.gitignore`; `task` command warns if missing |
| Gate-blocking logic is incomplete | Low | Medium | Gate check before `gh pr create` (Step 6.4); full gate enforcement in v0.3.0 |
| Old `agentflow-<name>` sessions orphaned on upgrade | Medium | Low | Migration instructions in Step 8.6; `agentcli install` suggests `tmux kill-server` |
| TUI 500ms poll causes flicker | Low | Low | Update only on content diff; clear via ANSI escape on change only |
| PR fails if branch has no remote | Low | Medium | Push branch with `--set-upstream` before `gh pr create` |

---

## Verification Steps (All 19 spec ACs + AC20)

```bash
# AC1 — TUI launches immediately
agentcli
# → TUI renders agent table within 2s; press q to exit

# AC2 — Column headers
# Visual: NAME, STATUS, TASK, PROVIDER, NAMESPACE all visible without scrolling

# AC3 — Namespace filtering
# In TUI: press n; select "core"; only core-namespace agents visible

# AC4 — Enter → 50-line tmux stream at 500ms
agentcli agents start coder
# In TUI: press Enter on coder row; count lines in detail pane (≥50); wait 1s, verify update

# AC5 — Command bar task input
# In TUI: type "write a hello world function"; press Enter
agentcli tasks list  # → new task with state pending or assigned

# AC6 — Auto-distribution
agentcli task "write tests for the auth module"
# → task assigned to qa agent (task type = test)
agentcli tasks list  # → state shows qa as assignee

# AC7 — @agent-name override
# In TUI command bar: @coder implement a fibonacci function
agentcli tasks list  # → assignee = coder, not auto-routed

# AC8 — config set-prompt persists
agentcli config set-prompt coder "Be concise"
cat .agent-cli/config.json | jq '.agents[] | select(.name=="coder") | .prompt'
# → "Be concise"

# AC9 — Both broadcast prefixes work
# In TUI: /broadcast hello world
cat .agent-cli/queue/broadcast.jsonl | tail -1  # → JSON entry
# In TUI: 공지! test message
cat .agent-cli/queue/broadcast.jsonl | tail -1  # → JSON entry

# AC10 — Broadcast queue path
ls .agent-cli/queue/broadcast.jsonl  # → exists

# AC11 — Claude OAuth login
agentcli auth login  # → browser opens; complete flow
agentcli auth status  # → claude: authenticated

# AC12 — Gemini OAuth
agentcli auth add --provider gemini  # → browser opens; complete flow
agentcli auth status  # → gemini: authenticated

# AC13 — OpenAI key in keychain (not plaintext)
agentcli auth add --provider openai --key sk-test-xxx
security find-generic-password -s agentcli -a openai-key 2>/dev/null; echo $?
# → 0 (found)
cat .agent-cli/config.json | grep 'sk-'  # → no output

# AC14 — Full pipeline with real PR
agentcli task "add a hello endpoint to the API"
# Watch output for: Branch created, Plan file path, agents assigned
ls ./claude/Plans/  # → <branch>.md exists
gh pr list  # → new PR visible after all gates pass

# AC15 — claude/ gitignored
cat .gitignore | grep 'claude/'  # → match

# AC16 — install sets up from scratch
agentcli install
# → tmux check: ok, gh check: ok, claude check: ok/warn, .agent-cli/ created, .gitignore updated

# AC17 — tmux sessions named agentcli-<name>
agentcli agents start-all
tmux ls | grep 'agentcli-'  # → 8+ sessions named agentcli-<name>
tmux ls | grep 'agentflow-'  # → no output

# AC18 — agents list
agentcli agents list
# → table with ≥8 agents (5 original + 3 new) showing name/status/provider/namespace

# AC19 — agents add
agentcli agents add --name foo --provider claude --namespace backend
agentcli agents list | grep foo  # → foo | stopped | claude | backend
agentcli agents start foo
tmux ls | grep 'agentcli-foo'  # → session exists

# AC20 — no plaintext keys
cat .agent-cli/config.json | grep 'sk-'  # → no output
cat .agent-cli/config.json | grep 'AAAA'  # → no output (no bearer tokens either)
```

---

## ADR: Evolutionary Rename + Gap-Fill with Identity Layer

**Decision:** Evolve AgentFlow 0.1.x into agentcli 0.2.0 by:
1. Extracting `src/branding.ts` constants for atomic, grep-auditable rename
2. Verifying + tuning three misclassified gaps (G2/G3/G4 already implemented)
3. Implementing four true gaps: rename (G1), `task`/`dispatch` commands (G5), plan markdown + real PR (G6/G6b)

**Drivers:**
1. AgentFlow implements ~70% of required functionality with production-tested bug fixes
2. Gap analysis verified against HEAD: G2/G3/G4 are closed; implementing them would duplicate working code
3. Branding constants make the rename atomic, reviewable, and reversible via a single commit
4. npm name `agentcli` must be confirmed as prerequisite

**Alternatives considered:**
- **Fork Claude Code as base**: 4-6x work, high regression risk, no spec-mandated benefit. Rejected.
- **Keep `agentflow` name**: Violates spec's explicit `agentcli` requirement. Rejected.
- **Scoped npm `@hitbee/agentcli`**: Valid contingency if `agentcli` name is taken. Same code, scoped publish.
- **Dual-publish (`agentflow-cli` + `agentcli`)**: Rejected — creates confusing dependency graph; deprecation notice on old package is sufficient.

**Why chosen:** Maximum reuse of working, bug-fixed code. Four true gaps are surgically scoped. Identity layer makes the rename safe and reviewable.

**Consequences:**
- **Positive**: All 19 spec ACs + AC20 (keychain) satisfied with minimal new code surface
- **Positive**: All existing OAuth/tmux/model-routing bug fixes carry forward
- **Positive**: Branding constants allow future rebranding without grep-and-replace
- **Negative**: Two binary names briefly during v0.2.x; documented migration path
- **Negative**: `AGENTFLOW_DEV` → `AGENTCLI_DEV` env var rename is a breaking change for dev users
- **Negative**: Gate-blocking enforcement is partial in v0.2.0 (gates checked before PR, but not enforced mid-pipeline)

**Follow-ups (post v0.2.0):**
- Full mid-pipeline gate enforcement (fail-fast on gate rejection)
- OMC's full 20-agent registry integration (currently adding 3)
- OpenCode's 20+ LLM provider support (currently 3)
- Evaluate CC QueryEngine as replacement for `src/agent/execution.ts`
- Remove deprecated `bin/agentflow` alias in v0.3.0
- Add `AGENTFLOW_DEV` → `AGENTCLI_DEV` migration warning in v0.2.x, remove in v0.3.0

---

## Changelog
- v1: Initial plan generated from deep-interview spec (ambiguity 16%, 10 rounds)
- v2: Revised after Architect review — reclassified G2/G3/G4 as verify+tune; added `src/branding.ts` pre-step; surfaced `gh pr create` stub as real gap (G6b); split `task` vs `dispatch` commands; added Step 0 npm name gate; corrected blast-radius list; added `COMPLETION_SIGNAL` constant
- v3 (final): Applied Critic improvements — fixed AC count reconciliation (19 spec + 1 derived = 20); fixed `ensureGitignore` to verify-only (no-arg function); expanded blast-radius to all confirmed sites; expanded verification steps to cover all 20 ACs; fixed `submitTask` positional signature; removed `import { Bun }` (global); added `claude` CLI preflight check; clarified Step 1.5 deprecated alias; added `COMPLETION_SIGNAL` retrofit to all existing agents; added Step 7.3 with explicit distributor.ts code; added gate-blocking check (Step 6.4); added user migration instructions (Step 8.6); added `npm deprecate` for old package
