/**
 * CLI agents subcommand for AgentFlow
 *
 * agentflow agents list [--namespace <ns>]
 * agentflow agents add --name <n> --provider <p> [--namespace <ns>]
 * agentflow agents start <name>
 * agentflow agents stop <name>
 * agentflow agents attach <name>
 */

import { Command } from 'commander';
import { listAgents, getAgent, registerAgent } from '../agent/registry.js';
import { tmuxManager } from '../agent/tmux-manager.js';
import { isAlive } from '../agent/heartbeat.js';
import type { AgentConfig } from '../types/index.js';

export function buildAgentsCommand(): Command {
  const agents = new Command('agents').description('List and manage agents');

  // agentflow agents list [--namespace <ns>]
  agents
    .command('list')
    .description('List registered agents with their status')
    .option('--namespace <ns>', 'Filter by namespace')
    .action(async (opts: { namespace?: string }) => {
      const { loadConfig } = await import('../config/index.ts');
      const config = loadConfig();
      for (const agent of Object.values(config.agents)) {
        registerAgent(agent);
      }
      const agentList = listAgents(opts.namespace);
      if (agentList.length === 0) {
        console.log('No agents found.');
        return;
      }

      // Fetch session status for all agents in parallel
      const statuses = await Promise.all(
        agentList.map(async a => {
          const sessionAlive = await tmuxManager.isSessionAlive(a.name);
          const heartbeatAlive = isAlive(a.name);
          let status = 'stopped';
          if (sessionAlive && heartbeatAlive) status = 'running';
          else if (sessionAlive) status = 'session-only';
          return { ...a, status };
        }),
      );

      // Print table
      const header = ['NAME', 'NAMESPACE', 'MODEL', 'STATUS', 'DESCRIPTION'];
      const rows = statuses.map(a => [
        a.name,
        a.namespace,
        a.model,
        a.status,
        a.description,
      ]);

      const colWidths = header.map((h, i) =>
        Math.max(h.length, ...rows.map(r => r[i].length)),
      );

      const fmt = (cols: string[]) =>
        cols.map((c, i) => c.padEnd(colWidths[i])).join('  ');

      console.log(fmt(header));
      console.log(colWidths.map(w => '-'.repeat(w)).join('  '));
      for (const row of rows) {
        console.log(fmt(row));
      }
    });

  // agentflow agents add --name <n> --provider <p> [--namespace <ns>]
  agents
    .command('add')
    .description('Register a new agent')
    .requiredOption('--name <name>', 'Agent name')
    .requiredOption('--provider <provider>', 'Provider (e.g. anthropic, google, openai)')
    .option('--namespace <ns>', 'Namespace', 'default')
    .option('--model <model>', 'Model ID')
    .option('--description <desc>', 'Agent description', '')
    .action(async (opts: { name: string; provider: string; namespace: string; model?: string; description: string }) => {
      const { loadConfig, saveConfig } = await import('../config/index.ts');
      const config = loadConfig();
      const defaultModels: Record<string, string> = {
        anthropic: 'claude-sonnet-4-6',
        google: 'gemini-2-flash',
        openai: 'gpt-4o',
      };
      const model = opts.model ?? defaultModels[opts.provider] ?? 'claude-sonnet-4-6';
      const newAgent: AgentConfig = {
        name: opts.name,
        description: opts.description || `Agent ${opts.name}`,
        prompt: `You are ${opts.name}, an AI assistant.`,
        model,
        provider: opts.provider,
        namespace: opts.namespace,
      };
      config.agents[opts.name] = newAgent;
      saveConfig(config);
      registerAgent(newAgent);
      console.log(`Agent "${opts.name}" added (provider: ${opts.provider}, model: ${model}, namespace: ${opts.namespace}).`);
    });

  // agentflow agents start <name>
  agents
    .command('start <name>')
    .description('Start a tmux session for an agent')
    .option('--command <cmd>', 'Command to run in session', 'bun run src/cli/index.ts')
    .action(async (name: string, opts: { command: string }) => {
      const agentConfig = getAgent(name);
      if (!agentConfig) {
        console.error(`Agent "${name}" not found. Use "agentflow agents add" to register it.`);
        process.exit(1);
      }
      const alive = await tmuxManager.isSessionAlive(name);
      if (alive) {
        console.log(`Agent "${name}" session is already running.`);
        return;
      }
      await tmuxManager.createSession(name, opts.command);
      console.log(`Agent "${name}" session started.`);
    });

  // agentflow agents stop <name>
  agents
    .command('stop <name>')
    .description('Stop the tmux session for an agent')
    .action(async (name: string) => {
      const alive = await tmuxManager.isSessionAlive(name);
      if (!alive) {
        console.log(`Agent "${name}" has no active session.`);
        return;
      }
      await tmuxManager.destroySession(name);
      console.log(`Agent "${name}" session stopped.`);
    });

  // agentflow agents attach <name>
  agents
    .command('attach <name>')
    .description('Attach to an agent\'s tmux session')
    .action(async (name: string) => {
      const alive = await tmuxManager.isSessionAlive(name);
      if (!alive) {
        console.error(`Agent "${name}" has no active session. Use "agentflow agents start ${name}" first.`);
        process.exit(1);
      }
      await tmuxManager.attachSession(name);
    });

  return agents;
}
