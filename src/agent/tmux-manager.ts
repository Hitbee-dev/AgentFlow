/**
 * Tmux Session Lifecycle Manager for AgentFlow
 *
 * Session naming: agentflow-<agentName>
 */

const SESSION_PREFIX = 'agentflow-';

function sessionName(agentName: string): string {
  return `${SESSION_PREFIX}${agentName}`;
}

// Use spawnSync — async Bun.spawn + piped stdout/stderr can deadlock
// when the subprocess writes enough to fill OS pipe buffers before we read.
function tmuxRun(args: string[]): { stdout: string; exitCode: number } {
  const proc = Bun.spawnSync(['tmux', ...args], {
    stdout: 'pipe',
    stderr: 'ignore',
  });
  return {
    stdout: new TextDecoder().decode(proc.stdout).trim(),
    exitCode: proc.exitCode ?? 1,
  };
}

export class TmuxManager {
  /** Create a new detached tmux session for an agent. */
  createSession(agentName: string, startCommand: string): void {
    const name = sessionName(agentName);
    // Pass -c to share the same working directory — CLI and worker must
    // agree on the .agent-cli/ path since all paths are relative.
    const { exitCode } = tmuxRun([
      'new-session', '-d', '-s', name, '-c', process.cwd(), startCommand,
    ]);
    if (exitCode !== 0) {
      throw new Error(`Failed to create tmux session for agent "${agentName}"`);
    }
  }

  /** Kill a tmux session for an agent. */
  destroySession(agentName: string): void {
    tmuxRun(['kill-session', '-t', sessionName(agentName)]);
  }

  /** Check if a tmux session is alive for an agent. */
  isSessionAlive(agentName: string): boolean {
    const { exitCode } = tmuxRun(['has-session', '-t', sessionName(agentName)]);
    return exitCode === 0;
  }

  /** List agent names that have active tmux sessions. */
  listSessions(): string[] {
    const { stdout, exitCode } = tmuxRun(['list-sessions', '-F', '#{session_name}']);
    if (exitCode !== 0 || !stdout) return [];
    return stdout
      .split('\n')
      .filter(line => line.startsWith(SESSION_PREFIX))
      .map(line => line.slice(SESSION_PREFIX.length));
  }

  /** Send input to an agent's tmux session. */
  sendInput(agentName: string, input: string): void {
    const { exitCode } = tmuxRun(['send-keys', '-t', sessionName(agentName), input, 'Enter']);
    if (exitCode !== 0) {
      throw new Error(`Failed to send input to agent "${agentName}"`);
    }
  }

  /** Capture the last N lines from an agent's tmux pane. */
  capturePane(agentName: string, lines = 50): string {
    const { stdout } = tmuxRun(['capture-pane', '-t', sessionName(agentName), '-p', '-S', `-${lines}`]);
    return stdout;
  }

  /** Attach to an agent's tmux session in the current terminal. */
  async attachSession(agentName: string): Promise<void> {
    const proc = Bun.spawn(['tmux', 'attach-session', '-t', sessionName(agentName)], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    });
    await proc.exited;
  }
}

export const tmuxManager = new TmuxManager();
