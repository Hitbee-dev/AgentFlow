# AgentFlow

> Orchestrate multiple AI agents from your terminal — k9s-style.

AgentFlow lets you run a team of AI agents (Claude, Gemini, GPT-4) in parallel, each in its own isolated tmux session, with a real-time dashboard to monitor and direct them.

[![npm](https://img.shields.io/npm/v/agentflow-cli)](https://www.npmjs.com/package/agentflow-cli)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

## Why AgentFlow?

- **Local-first** — no server, no cloud accounts beyond your AI provider
- **Multi-provider** — Claude (OAuth), Gemini, OpenAI in one workflow
- **Parallel agents** — each agent runs isolated in its own tmux session
- **Smart routing** — tasks auto-assigned by type (code/review/plan/test/security)
- **Real-time TUI** — k9s-style dashboard to monitor all agents at once
- **Dev pipeline** — automated branch → implement → review → PR flow

## Installation

```bash
npm install -g agentflow-cli
```

Or build from source (requires [Bun](https://bun.sh)):
```bash
git clone https://github.com/Hitbee-dev/AgentFlow.git
cd AgentFlow && bun install && bun run build
cp dist/agentflow ~/.local/bin/agentflow
```

## Quick Start

```bash
agentflow install          # first-time setup
agentflow auth login       # connect Claude via OAuth (browser)
agentflow agents start-all # start all agent workers
agentflow                  # open the TUI dashboard
```

From the TUI you can submit tasks, filter by namespace, and watch agents work in real time.

## Architecture

```
agentflow
├── src/auth/       OAuth PKCE + OS keychain (Claude / Gemini / OpenAI)
├── src/provider/   Vercel AI SDK multi-provider abstraction
├── src/agent/      tmux sessions, heartbeat, dispatch queue, broadcast
├── src/orchestrator/ Task routing — auto by type, manual by @agent
├── src/pipeline/   Automated dev pipeline (branch → PR)
├── src/tui/        React/Ink k9s-style dashboard
└── src/cli/        Commander.js CLI commands
```

**Runtime:** Bun · **UI:** React/Ink · **LLM:** Vercel AI SDK · **Auth:** OS keychain

## Default Agents

| Name | Role | Model |
|------|------|-------|
| planner | Feature design & specs | claude-opus-4-6 |
| coder | Implementation | claude-sonnet-4-6 |
| reviewer | Code quality review | claude-sonnet-4-6 |
| security | Security audit | claude-opus-4-6 |
| qa | Testing & verification | claude-sonnet-4-6 |

## Key Commands

```bash
agentflow                          # TUI dashboard
agentflow run "<task>"             # submit task (auto-assigned)
agentflow run --agent coder "<task>" # assign to specific agent
agentflow chat planner "<msg>"     # one-shot streaming chat
agentflow pipeline start "<desc>"  # start automated dev pipeline
agentflow status                   # quick overview
agentflow doctor                   # health check
```

**TUI shortcuts:** `↑/↓` navigate · `Enter` detail · `Esc` back · `:q` quit  
**TUI commands:** `:ns <name>` filter namespace · `@agent <task>` assign · `공지! <msg>` broadcast

## Supported Models

| Provider | Models |
|----------|--------|
| Anthropic | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |
| Google | gemini-2.5-pro, gemini-2.0-flash |
| OpenAI | o1, gpt-4o, gpt-4o-mini |

## License

Apache-2.0 © [Hitbee-dev](https://github.com/Hitbee-dev)
