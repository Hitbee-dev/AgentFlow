/**
 * Tmux Session Lifecycle Manager for AgentFlow
 *
 * Session naming: agentflow-<agentName>
 */

const SESSION_PREFIX = 'agentflow-';

function sessionName(agentName: string): string {
  return `${SESSION_PREFIX}${agentName}`;
}

async function tmuxRun(args: string[]): Promise<{ stdout: string; exitCode: number }> {
  const proc = Bun.spawn(['tmux', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), exitCode };
}

export class TmuxManager {
  /** Create a new detached tmux session for an agent. */
  async createSession(agentName: string, startCommand: string): Promise<void> {
    const name = sessionName(agentName);
    const { exitCode } = await tmuxRun([
      'new-session', '-d', '-s', name, startCommand,
    ]);
    if (exitCode !== 0) {
      throw new Error(`Failed to create tmux session for agent "${agentName}"`);
    }
  }

  /** Kill a tmux session for an agent. */
  async destroySession(agentName: string): Promise<void> {
    const name = sessionName(agentName);
    await tmuxRun(['kill-session', '-t', name]);
  }

  /** Check if a tmux session is alive for an agent. */
  async isSessionAlive(agentName: string): Promise<boolean> {
    const name = sessionName(agentName);
    const { exitCode } = await tmuxRun(['has-session', '-t', name]);
    return exitCode === 0;
  }

  /** List agent names that have active tmux sessions. */
  async listSessions(): Promise<string[]> {
    const { stdout, exitCode } = await tmuxRun([
      'list-sessions', '-F', '#{session_name}',
    ]);
    if (exitCode !== 0 || !stdout) return [];
    return stdout
      .split('\n')
      .filter(line => line.startsWith(SESSION_PREFIX))
      .map(line => line.slice(SESSION_PREFIX.length));
  }

  /** Send input to an agent's tmux session. */
  async sendInput(agentName: string, input: string): Promise<void> {
    const name = sessionName(agentName);
    const { exitCode } = await tmuxRun([
      'send-keys', '-t', name, input, 'Enter',
    ]);
    if (exitCode !== 0) {
      throw new Error(`Failed to send input to agent "${agentName}"`);
    }
  }

  /** Capture the last N lines from an agent's tmux pane. */
  async capturePane(agentName: string, lines: number = 50): Promise<string> {
    const name = sessionName(agentName);
    const { stdout } = await tmuxRun([
      'capture-pane', '-t', name, '-p', '-S', `-${lines}`,
    ]);
    return stdout;
  }

  /** Attach to an agent's tmux session in the current terminal. */
  async attachSession(agentName: string): Promise<void> {
    const name = sessionName(agentName);
    const proc = Bun.spawn(['tmux', 'attach-session', '-t', name], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    });
    await proc.exited;
  }
}

export const tmuxManager = new TmuxManager();
