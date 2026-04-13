# AgentFlow

> Multi-agent CLI orchestrator with k9s-style monitoring

**agentflow** is a local-first CLI tool for orchestrating multiple AI agents (Claude, Gemini, GPT-4) with real-time k9s-style TUI monitoring, automatic task distribution, and a fully automated dev pipeline.

[![npm](https://img.shields.io/npm/v/agentflow-cli)](https://www.npmjs.com/package/agentflow-cli)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

## Features

- **k9s-style TUI** — real-time agent dashboard with namespace filtering
- **Multi-provider** — Claude (OAuth), Gemini (OAuth or API key), OpenAI (API key)
- **Agent isolation** — each agent runs in its own tmux session
- **Smart task routing** — auto-distributes by task type (code/review/plan/test/security)
- **Manual routing** — `@agent-name task` to assign directly
- **Broadcast** — `공지! message` sends to all agents at once
- **Dev pipeline** — branch → plan → implement → security-review → code-review → QA → PR
- **No server** — fully local, credentials in OS keychain

## Installation

### From npm
```bash
npm install -g agentflow-cli
```

### From source (requires [Bun](https://bun.sh))
```bash
git clone https://github.com/Hitbee-dev/AgentFlow.git
cd AgentFlow
bun install
bun run build
cp dist/agentflow ~/.local/bin/agentflow
```

## Quick Start

```bash
# 1. Initial setup
agentflow install

# 2. Connect Claude (OAuth)
agentflow auth login

# Or add OpenAI key
agentflow auth add --provider openai --key sk-xxx

# Or add Gemini key (Google AI Studio)
agentflow auth add --provider gemini --key AIza...

# 3. Start all agents
agentflow agents start-all

# 4. Launch TUI dashboard
agentflow
```

## Commands

### TUI Dashboard
```bash
agentflow              # Launch k9s-style dashboard
agentflow tui          # Same as above
agentflow status       # Quick overview (agents + tasks + auth)
```

**TUI keyboard shortcuts:**
- `↑/↓` — navigate agents
- `Enter` — view agent detail
- `Esc` — back to table
- `:q` — quit
- `:ns <name>` — filter by namespace
- `@agent <task>` — assign task to specific agent
- `공지! <msg>` — broadcast to all agents

### Authentication
```bash
agentflow auth login                              # Claude OAuth (browser)
agentflow auth add --provider openai --key sk-xxx # OpenAI API key
agentflow auth add --provider gemini --key AIza.. # Gemini API key
agentflow auth status                             # Show auth state
agentflow auth logout [--provider <name>]         # Remove credentials
```

### Agents
```bash
agentflow agents list [--namespace <ns>]   # List agents with status
agentflow agents info <name>               # Detailed agent config
agentflow agents add --name <n> \
  --provider <p> [--model <m>]             # Register new agent
agentflow agents start <name>              # Start tmux worker session
agentflow agents start-all                 # Start all agents
agentflow agents stop <name>               # Stop agent session
agentflow agents stop-all                  # Stop all agents
agentflow agents attach <name>             # Attach to tmux session
agentflow agents logs <name> [-n 50]       # View agent output
```

### Tasks
```bash
agentflow run <task>                       # Submit task (auto-assigned)
agentflow run --agent <name> <task>        # Assign to specific agent
agentflow run --wait <task>                # Wait for completion
agentflow chat <agent> <message>           # One-shot streaming chat
agentflow tasks list [--state <s>]         # List tasks
agentflow tasks show <id>                  # Task details (supports prefix)
agentflow tasks cancel <id>                # Cancel pending task
```

### Broadcast
```bash
agentflow broadcast <message>              # Send to all agents
# From TUI: 공지! <message>
# From TUI: /broadcast <message>
```

### Pipeline
```bash
agentflow pipeline start "<description>"   # Start automated dev pipeline
agentflow pipeline status [id]             # Show pipeline + gate results
agentflow pipeline cancel <id>             # Cancel pipeline
```

### Config
```bash
agentflow config show                      # Full config JSON
agentflow config get defaults.provider     # Get a value
agentflow config set defaults.provider anthropic  # Set a value
agentflow config set-prompt <agent> "<prompt>"    # Custom system prompt
agentflow config models                    # List all 8 supported models
agentflow install                          # Re-run setup wizard
```

## Supported Models

| Provider | Model | Tier | Context |
|----------|-------|------|---------|
| Anthropic | claude-opus-4-6 | deep | 200k |
| Anthropic | claude-sonnet-4-6 | standard | 200k |
| Anthropic | claude-haiku-4-5-20251001 | fast | 200k |
| Google | gemini-2.5-pro | deep | 1M |
| Google | gemini-2.0-flash | fast | 1M |
| OpenAI | o1 | deep | 128k |
| OpenAI | gpt-4o | standard | 128k |
| OpenAI | gpt-4o-mini | fast | 128k |

## Default Agents

| Name | Namespace | Role | Default Model |
|------|-----------|------|---------------|
| planner | core | Plans features, writes specs | claude-opus-4-6 |
| coder | core | Implements features | claude-sonnet-4-6 |
| reviewer | review | Code quality review | claude-sonnet-4-6 |
| security | review | Security audit | claude-opus-4-6 |
| qa | review | Tests & verification | claude-sonnet-4-6 |

## Architecture

```
agentflow
├── src/
│   ├── cli/          # Commander.js CLI commands
│   ├── auth/         # OAuth PKCE + keychain (Claude/Gemini/OpenAI)
│   ├── provider/     # Vercel AI SDK multi-provider abstraction
│   ├── agent/        # tmux sessions, heartbeat, dispatch queue, broadcast
│   ├── orchestrator/ # Task routing, manual/auto distribution
│   ├── pipeline/     # Automated dev pipeline (branch→PR)
│   ├── tui/          # React/Ink k9s-style dashboard
│   ├── config/       # Config schema (Zod), gitignore management
│   └── types/        # Shared TypeScript types
├── tests/            # 47 unit + integration tests
└── dist/agentflow    # Single compiled binary (bun compile)
```

**Runtime:** Bun · **UI:** React/Ink · **LLM:** Vercel AI SDK · **Auth:** OS keychain

## Development

```bash
bun install
bun run dev            # Run CLI in dev mode
bun test               # Run 47 tests
bun run build          # Compile single binary → dist/agentflow
```

## License

Apache-2.0 © [Hitbee-dev](https://github.com/Hitbee-dev)
