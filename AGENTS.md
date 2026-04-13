# AgentFlow — Session Handoff

> 이 파일은 세션 재시작 시 다음 Agent가 컨텍스트를 완전히 이어받기 위한 핸드오프 문서입니다.
> 작업 완료 후 이 파일을 업데이트해주세요.

---

## 프로젝트 정체성

| 항목 | 값 |
|------|-----|
| **프로젝트명** | AgentFlow |
| **npm 패키지명** | `agentflow-cli` |
| **바이너리 명령어** | `agentflow` |
| **GitHub Repo** | `Hitbee-dev/AgentFlow` (구 이름: Agent-CLI) |
| **로컬 경로** | `/Users/chankim/dev/AgentFlow` |
| **라이선스** | Apache-2.0 |
| **런타임** | Bun |
| **현재 버전** | 0.0.1 (플레이스홀더, npm 선점용) |

---

## 프로젝트 개요

**AgentFlow**는 다중 AI 에이전트 CLI 오케스트레이터입니다.

- **k9s-style TUI**: `agentflow` 실행 시 즉시 에이전트 모니터링 대시보드 표시
- **멀티 프로바이더**: Claude (OAuth), Gemini (CLI/OAuth), OpenAI (API Key) 동시 지원
- **에이전트 런타임**: 각 Agent = 독립적인 tmux 세션 (격리, 충돌 없음)
- **하이브리드 작업 분배**: 자동 분배 기본, `@agent-name 작업` 으로 수동 지정 가능
- **공지 브로드캐스트**: 메시지 큐 방식 (`.agent-cli/queue/broadcast.jsonl`), 작업 중인 Agent는 완료 후 반영
- **완전 자동 개발 파이프라인**: branch → plan → work → security review → code review → QA → PR
- **서버 없음**: 완전 로컬 전용, OS keychain에 인증 정보 저장
- **`./claude/` 절대 커밋 금지**: gitignore로 관리

### 참고 레포 (소스코드 가져올 곳)

| 레포 | 경로 | 역할 |
|------|------|------|
| claude-code | `/Users/chankim/dev/claude-code` | **베이스 포크** — CLI(Commander.js+React/Ink), AgentTool, OAuth, LLM 루프 |
| oh-my-claudecode | `/Users/chankim/dev/oh-my-claudecode` | **에이전트 엔진** — 19개 에이전트, 38개 스킬, 55모듈 팀 엔진 |
| opencode | `/Users/chankim/dev/opencode_init/opencode` | **멀티 프로바이더** — Vercel AI SDK 기반 프로바이더 추상화 |
| oh-my-opencode | `/Users/chankim/dev/opencode_init/oh-my-opencode` | **패턴** — TmuxSessionManager, BackgroundManager |
| paperclip | `/Users/chankim/dev/paperclip` | **인증 패턴만** — 멀티 프로바이더 크리덴셜 구조 |

---

## 현재 상태 (세션 종료 시점)

### 완료된 작업
- [x] Deep Interview 완료 (10라운드, 최종 모호도 16%)
- [x] Spec 파일 작성: `/Users/chankim/dev/AgentFlow/.omc/specs/deep-interview-agent-cli.md`
- [x] 초기 Plan 파일 작성: `~/.claude/plans/zany-knitting-planet.md`
- [x] 프로젝트명 결정: AgentFlow (agentflow)
- [x] npm 패키지명 선점: `agentflow-cli` (0.0.1 publish 완료 ✓)
- [x] `package.json` 생성 (0.0.1 플레이스홀더)
- [x] `README.md` 업데이트
- [x] GitHub Repo: `Hitbee-dev/AgentFlow` (git remote 수정 완료)
- [x] **Ralplan 합의 완료** (2 iteration, Critic APPROVE)
  - 플랜: `/Users/chankim/dev/AgentFlow/.omc/plans/agentflow-implementation.md`
  - 총 추정: 46-67일 (Phase 0-8)

### 미완료 / 다음 세션에서 해야 할 작업

#### 🔴 지금 해야 할 것
**Phase 0 구현 시작**: `setup/initial-structure` 브랜치에서 시작
- 플랜: `/Users/chankim/dev/AgentFlow/.omc/plans/agentflow-implementation.md`
- Branch: `git checkout -b setup/initial-structure`

#### 🟢 이후 구현 순서 (Phase별)

**Phase 0: Repo 초기 세팅**
- Branch: `setup/initial-structure`
- `.gitignore` 추가 (`./claude/`, `.agent-cli/` 제외)
- TypeScript + Bun 프로젝트 초기화
- 디렉토리 구조 생성 (`src/cli`, `src/auth`, `src/providers`, `src/agents`, `src/runtime`, `src/tui`, `src/orchestrator`, `src/pipeline`, `src/queue`, `src/config`)

**Phase 1: Auth Layer** (`feature/auth-layer`)
- Claude Code OAuth 포팅 (`claude-code/src/services/oauth/`)
- OS Keychain 연동
- Gemini CLI OAuth, OpenAI API Key 지원

**Phase 2: Provider Layer** (`feature/provider-layer`)
- OpenCode의 Vercel AI SDK 기반 멀티 프로바이더 포팅
- `opencode/packages/opencode/src/provider/`

**Phase 3: Agent Runtime** (`feature/agent-runtime`)
- tmux 세션 매니저 구현 (세션명: `agentflow-<name>`)
- OMC 19개 에이전트 정의 포팅
- 메시지 큐 구현

**Phase 4: k9s-style TUI** (`feature/tui`)
- React/Ink 기반 (claude-code의 컴포넌트 시스템 활용)
- 에이전트 테이블, 네임스페이스 필터, 명령 입력창

**Phase 5: Task Orchestrator** (`feature/orchestrator`)
- 자동 분배 + `@agent-name` 수동 지정
- 브로드캐스트 큐

**Phase 6: Dev Pipeline** (`feature/dev-pipeline`)
- 완전 자동: branch → plan → work → review → QA → PR
- OMC team engine 기반 (`oh-my-claudecode/src/team/`)

**Phase 7: Security & Config** (`feature/security-config`)
- API key keychain 저장, gitignore 자동 관리

**Phase 8: Install & Distribution** (`feature/install`)
- `agentflow install` 마법사
- `bun build --compile` 단일 바이너리
- npm publish (실제 구현 버전)

---

## 개발 워크플로우 규칙 (모든 작업에 적용)

1. **기능마다 Branch 생성** (`feature/<name>`, `fix/<name>`, `setup/<name>`)
2. **Plan 먼저 작성** → `./claude/Plans/<branch-name>.md` (gitignored)
3. **PR 조건**: security-reviewer PASS + code-reviewer PASS + QA PASS 필수
4. **`./claude/` 절대 commit 금지**
5. **각 PR은 master branch로 머지**

---

## 핵심 파일 위치

| 파일 | 경로 |
|------|------|
| Deep Interview Spec | `/Users/chankim/dev/AgentFlow/.omc/specs/deep-interview-agent-cli.md` |
| 초기 Plan | `~/.claude/plans/zany-knitting-planet.md` |
| package.json | `/Users/chankim/dev/AgentFlow/package.json` |
| ralplan 상태 | `/Users/chankim/dev/AgentFlow/.omc/state/sessions/forge-consensus-001/ralplan-state.json` |

---

## 다음 세션 시작 체크리스트

- [x] `npm publish` 완료 (`npm view agentflow-cli` 로 확인 가능)
- [ ] ralplan 재시작: `/oh-my-claudecode:plan --consensus --direct .omc/specs/deep-interview-agent-cli.md`
- [ ] ralplan 완료 후 autopilot으로 구현 시작
