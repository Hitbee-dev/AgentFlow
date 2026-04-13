# Open Questions

## AgentFlow Implementation - 2026-04-13

### Resolved by Architect/Critic Review

- [x] **Effect-TS stripping strategy**: Resolved -- port only Vercel AI SDK factory calls (~200 lines), rewrite registry/DI/model resolution in plain TypeScript. Replace `Schema.brand` with Zod or plain unions. Replace Effect error channel with Result pattern or throw/catch. Phase 2 reclassified as HIGH (7-10 days).
- [x] **Broadcast queue semantics**: Resolved -- removed `read_by` array (race condition). Replaced with per-agent pointer files at `.agent-cli/queue/pointers/{agent-name}.offset`. Append-only JSONL + per-agent byte offset = no shared mutable state.
- [x] **TUI framework choice**: Partially resolved -- React/Ink remains the choice, but Phase 0 now includes an Ink+Bun compatibility spike. If spike fails, evaluate blessed/neo-blessed as fallback.

### Open

- [ ] **Gemini CLI OAuth specifics**: Google's OAuth for CLI tools may require a GCP project with OAuth client ID. Do we create a shared AgentFlow OAuth client ID, or require users to bring their own GCP project? -- Affects Phase 1 complexity and user onboarding friction.

- [ ] **Agent prompt format**: Should agent system prompts be plain text, markdown, or structured YAML with metadata (model preference, tool restrictions, etc.)? -- Affects Phase 3 agent registry design and config system.

- [ ] **tmux fallback for non-tmux environments**: What happens on machines without tmux (e.g., Windows WSL without tmux, CI environments)? Should we support a degraded mode with child processes instead? -- Affects Phase 3 scope and Phase 8 cross-platform support.

- [ ] **Pipeline customization**: Should users be able to define custom pipeline stages, or is the default 7-stage pipeline fixed? -- Affects Phase 6 scope (fixed is simpler, custom is more powerful).

- [ ] **Multi-repo support**: The spec mentions `.agent-cli/` relative to project root. Should AgentFlow support orchestrating across multiple repos simultaneously? -- Affects Phase 5 task distribution and Phase 3 agent working directories.

- [ ] **Bun compile binary size target**: Bun-compiled binaries can be 50-100MB+. Is there an acceptable size ceiling? -- Affects Phase 8 distribution strategy (binary vs requiring Bun runtime).

- [ ] **Ink + Bun compatibility**: Phase 0 spike will validate this. If Ink does not render correctly under `bun run`, need to decide fallback TUI framework before Phase 4. -- Blocks Phase 4 approach.

- [ ] **Linux keychain availability**: `secret-tool` (libsecret) may not be installed on all Linux distros. Should we provide a fallback (encrypted file with user passphrase)? -- Affects Phase 1 keychain adapter on Linux.

- [ ] **Credential pre-flight reassignment policy**: When a provider's credentials expire and refresh fails mid-pipeline, should the orchestrator reassign to another provider automatically, or pause and ask the user? -- Affects Phase 5 orchestrator and Phase 6 pipeline resilience.
