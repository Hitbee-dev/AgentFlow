# Deep Interview Spec: Agent-CLI

## Metadata
- Interview ID: agent-cli-deep-001
- Rounds: 10
- Final Ambiguity Score: 16%
- Type: brownfield
- Generated: 2026-04-13
- Threshold: 0.2
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.92 | 0.35 | 0.322 |
| Constraint Clarity | 0.85 | 0.25 | 0.213 |
| Success Criteria | 0.75 | 0.25 | 0.188 |
| Context Clarity | 0.80 | 0.15 | 0.120 |
| **Total Clarity** | | | **0.843** |
| **Ambiguity** | | | **16%** |

---

## Goal

Build **agentcli** — a unified, serverless, local-first multi-agent CLI orchestrator that combines:
- **Claude Code** (forked base) + **OMC (oh-my-claudecode)** for agent engine and skills
- **OpenCode** (all features merged) for multi-provider LLM support and additional tools
- **PaperClip** auth patterns for multi-provider credential management (no server)
- **k9s-style TUI** for real-time agent monitoring, namespace filtering, and command input
- **Fully automatic dev pipeline**: branch → plan → work → security review → code review → QA → PR → merge

---

## Constraints

- **No server required**: purely local CLI, all state stored on disk
- **Runtime: Bun** (matches Claude Code + OpenCode)
- **Package name: `agentcli`** (npm, globally installable)
- **Agent runtime: tmux** — each agent runs as an isolated tmux session
- **Multi-provider auth**: Claude Code OAuth, Anthropic API key, Gemini OAuth/CLI, OpenAI API key, others via OpenCode provider abstraction
- **Default provider: Claude Code OAuth**
- **./claude directory NEVER committed** (gitignored, local-only)
- **Plans stored at ./claude/Plans/** (local-only, gitignored)
- **Feature branches**: every feature gets its own branch before work begins
- **PR gates**: security review + code review + QA must all pass before PR is created

## Non-Goals

- Web UI or server dashboard (PaperClip's Express/PostgreSQL stack not included)
- SaaS or multi-user remote access
- Managing agents on remote machines
- Building a new LLM from scratch

---

## Acceptance Criteria

- [ ] `agentcli` command launches k9s-style TUI immediately (no sub-command needed)
- [ ] TUI shows agent table: NAME, STATUS, TASK, PROVIDER, NAMESPACE columns
- [ ] Namespace filtering works: user can view all agents or filter by namespace group
- [ ] Pressing Enter on an agent shows that agent's thinking/reasoning stream (from tmux pane)
- [ ] User can type task instructions in the TUI command bar (natural language)
- [ ] Auto-distribution assigns task to best available idle agent (role/provider-aware)
- [ ] User can override with `@agent-name task description` for manual assignment
- [ ] System prompt injection works: `agentcli config set-prompt agent-1 "..."` persists
- [ ] Broadcast via `公지! message` (or `/broadcast message`): queued in message queue, idle agents pick up immediately, working agents pick up after current task completes
- [ ] Broadcast message queue stored in `.agent-cli/queue/broadcast.jsonl` (append-only)
- [ ] Auth: `agentcli auth login` triggers Claude Code OAuth flow (default)
- [ ] Auth: `agentcli auth add --provider gemini` triggers Gemini CLI OAuth
- [ ] Auth: `agentcli auth add --provider openai --key sk-xxx` stores API key securely (keychain)
- [ ] Dev pipeline: `agentcli task "..."` automatically: (1) creates git branch, (2) writes plan to `./claude/Plans/<branch>.md`, (3) assigns executor agents, (4) assigns security-reviewer agent, (5) assigns code-reviewer agent, (6) assigns QA agent, (7) creates PR only if all reviewers pass
- [ ] `./claude/` is in `.gitignore` — never committed
- [ ] `agentcli install` sets up everything from scratch (tmux check, auth, config)
- [ ] Each agent runs as an isolated tmux session (`agentcli-<name>` session naming)
- [ ] `agentcli agents list` shows all agents with status
- [ ] `agentcli agents add --name foo --provider claude --namespace backend` creates new agent
- [ ] Security: API keys stored in OS keychain (macOS Keychain / libsecret), never in plaintext config files

---

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| Agent-CLI is a management layer over CC/OC | Showed 4 architecture options | **Unified Fork** — CC as base, OC features merged in |
| OpenCode just means multi-provider | Asked specifically | **全부 통합** — multi-provider + all OC features |
| Auth needs a server | PaperClip has server auth | **Serverless** — local credential storage, OS keychain |
| MVP can be phased | Contrarian challenge on scope | **전체 비전 한번에** — full scope from start |
| Agents run in-process | Showed 3 runtime options | **tmux** — separate processes for isolation + monitoring |
| Broadcasts need real-time push | Asked about mechanism | **Message queue** — file-based queue, poll on task completion |
| Package name is "agent-cli" | npm check showed it's taken | **`agentcli`** — available on npm |
| Runtime can be Node.js | OMC uses Node, CC/OC use Bun | **Bun** — consistent with CC + OC source |

---

## Technical Context (Brownfield)

### Source Repos → Agent-CLI Mapping

| Repo | Path | What we take |
|------|------|-------------|
| `claude-code` | `/Users/chankim/dev/claude-code` | **Base fork**: CLI framework (Commander.js + React/Ink), AgentTool, TeamTool, OAuth service, permission system, QueryEngine (LLM loop), all tools |
| `oh-my-claudecode` | `/Users/chankim/dev/oh-my-claudecode` | **Plugin layer**: 19 agent definitions, 38 skills, 48+ hooks, team engine (55 modules), MCP tools server, state management |
| `opencode` | `/Users/chankim/dev/opencode_init/opencode` | **Multi-provider**: provider abstraction layer (Vercel AI SDK), session management (SQLite/Drizzle), multi-model routing, additional tools (plan, todo, etc.) |
| `oh-my-opencode` | `/Users/chankim/dev/opencode_init/oh-my-opencode` | **Agents/Hooks**: background agent manager, TmuxSessionManager, delegate-task tool, LSP/AST tools |
| `paperclip` | `/Users/chankim/dev/paperclip` | **Auth patterns only**: multi-provider credential structure, JWT agent auth patterns (adapted for local/tmux use) |

### Key Technical Decisions

- **TUI Framework**: React + Ink (from Claude Code) — already has 140 components for terminal UI
- **Agent processes**: tmux sessions named `agentcli-<name>`, logs captured via `tmux pipe-pane`
- **Provider abstraction**: OpenCode's Vercel AI SDK layer wraps Anthropic, OpenAI, Gemini, etc.
- **Auth storage**: macOS Keychain (from Claude Code's `OAuthService`) + cross-platform fallback
- **State files**: `.agent-cli/` directory (gitignored), JSON/JSONL for queue, SQLite for agent state
- **Build**: Bun + TypeScript, bundled to single binary via `bun build --compile`
- **Dev pipeline automation**: oh-my-claudecode's team pipeline (55-module engine) adapted for agent-cli's workflow

### Critical Source Files

- `claude-code/src/tools/AgentTool/runAgent.ts` — agent execution loop to adapt
- `claude-code/src/services/oauth/index.ts` — OAuth service to extend for multi-provider
- `claude-code/src/coordinator/coordinatorMode.ts` — coordinator logic to adapt
- `oh-my-claudecode/src/team/` — 55-module team engine (pipeline, runtime, worker mgmt)
- `oh-my-claudecode/src/agents/definitions.ts` — agent registry to merge/extend
- `opencode/packages/opencode/src/provider/` — provider abstraction to integrate
- `oh-my-opencode/src/features/background-agent/manager.ts` — BackgroundManager (1377 lines)
- `oh-my-opencode/src/tools/delegate-task/` — parallel agent dispatch pattern

---

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Agent-CLI | core domain | version, config, defaultProvider | contains Agents, has Credential Store |
| Agent | core domain | name, namespace, provider, status, currentTask, systemPrompt | runs in tmux Session, executes Tasks |
| Task | core domain | id, description, assignee, status, branch, planPath | assigned to Agent, has Pipeline |
| Pipeline | supporting | branch, planPath, stages[], currentStage, prUrl | drives Task through dev workflow |
| Namespace | core domain | name, agents[] | groups Agents for monitoring/filtering |
| tmux Session | supporting | sessionName, paneId, logPath | runs one Agent |
| TUI | core domain | currentView, selectedAgent, namespaceFilter | shows Agents, accepts Commands |
| Provider | supporting | type (claude/gemini/openai/etc), credentials | used by Agent for LLM calls |
| Credential | supporting | provider, type (oauth/apikey), storage (keychain) | attached to Provider |
| Message Queue | supporting | path (.agent-cli/queue/), entries[] | delivers Broadcasts to Agents |
| Announcement | supporting | content, timestamp, targetNamespace | queued in Message Queue |
| System Prompt | supporting | content, agentName | persisted per Agent in config |
| Plan | supporting | path (./claude/Plans/<branch>.md), content | guides Agent work, gitignored |
| Session | supporting | provider, token, expiry | represents authenticated user/provider |
| Auth | supporting | methods[], defaultMethod | manages Credentials and Sessions |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 7 | 7 | - | - | N/A |
| 2 | 10 | 3 | 0 | 7 | 70% |
| 3 | 11 | 1 | 1 | 9 | 82% |
| 4 | 11 | 0 | 0 | 11 | 100% |
| 5 | 12 | 1 | 0 | 11 | 92% |
| 6 | 12 | 0 | 0 | 12 | 100% |
| 7 | 13 | 1 | 0 | 12 | 92% |
| 8 | 14 | 1 | 0 | 13 | 93% |
| 9 | 14 | 0 | 0 | 14 | 100% |
| 10 | 15 | 1 | 0 | 14 | 93% |

---

## Interview Transcript

<details>
<summary>Full Q&A (10 rounds)</summary>

### Round 1
**Q:** Agent-CLI의 핵심 아키텍처 — 관리 레이어, 통합 포크, 플러그인 허브, PaperClip 확장?
**A:** 통합 포크 (Unified Fork) — Claude Code Core + OpenCode features + PaperClip auth + OMC agents/skills, all in single process
**Ambiguity:** 80%

### Round 2
**Q:** OpenCode에서 가져오고 싶은 것 — 멀티 프로바이더, 독립 백엔드, TUI, 전체?
**A:** 전체 통합 (모두 가져오기)
**Extra context added:** k9s-style 모니터링 시스템 필요 — 전체 뷰, 네임스페이스 필터, 개별 Agent 상세
**Ambiguity:** 73%

### Round 3
**Q:** "로그인"의 의미 — 사용자 계정, API 키, OAuth 통합, 하이브리드?
**A:** 서버 없이, Claude Code OAuth + Gemini CLI + API Key 모두 지원. 기본값은 Claude Code
**Ambiguity:** 61%

### Round 4 (Contrarian)
**Q:** MVP 최소 기능 세트 — Core Agent, 전체 비전, 인증+모니터링 우선?
**A:** Phase 1: 전체 비전 구현 (한번에)
**Ambiguity:** 54%

### Round 5
**Q:** 실행하면 첫 화면 — k9s TUI, REPL+모니터 명령어, 듀얼 모드?
**A:** k9s 스타일 TUI 먼저 (agent 목록, namespace 필터, 명령 입력창)
**Ambiguity:** 48%

### Round 6 (Simplifier)
**Q:** 작업 분배 메커니즘 — 자동, 수동, 하이브리드, PaperClip 스타일?
**A:** 하이브리드 (자동 + 수동) — 기본 자동, @agent-name으로 수동 가능
**Ambiguity:** 41%

### Round 7
**Q:** Agent 실행 방식 — tmux, in-process, 하이브리드?
**A:** 별도 프로세스 (tmux)
**Ambiguity:** 33%

### Round 8
**Q:** 개발 워크플로우 자동화 수준 — 완전 자동, 반자동, 수동?
**A:** 완전 자동 파이프라인
**Ambiguity:** 27%

### Round 9
**Q:** 런타임 — Bun, Node.js, 하이브리드?
**A:** Bun (기본 런타임). 패키지명 `agentcli` 확정
**Ambiguity:** 21%

### Round 10
**Q:** 공지 브로드캐스트 메커니즘 — 메시지 큐, tmux send-keys, 파일 폴링?
**A:** 메시지 큐 방식 (file-based, agents poll on task completion)
**Ambiguity:** 16% ✅ PASSED

</details>
