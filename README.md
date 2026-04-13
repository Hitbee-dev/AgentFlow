# AgentFlow

> Multi-agent CLI orchestrator with k9s-style monitoring

**agentflow** is a local-first CLI tool for orchestrating multiple AI agents (Claude, Gemini, GPT) with real-time k9s-style TUI monitoring, automatic task distribution, and a fully automated dev pipeline.

## Status

🚧 **Under active development** — v0.1.0 coming soon.

## Installation

```bash
npm install -g agentflow
```

## Usage

```bash
agentflow
```

## Features (coming in v0.1.0)

- k9s-style TUI for real-time agent monitoring
- Multi-provider support (Claude, Gemini, OpenAI)
- Automatic task distribution with namespace grouping
- Broadcast announcements to all agents
- Fully automated dev pipeline (branch → plan → review → QA → PR)
- Serverless, local-first — no server required

## License

Apache-2.0
