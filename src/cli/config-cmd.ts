import { Command } from 'commander';
import { loadConfig, saveConfig } from '../config/index.ts';
import { listAgents } from '../agent/registry.ts';

export function buildConfigCommand(): Command {
  const cmd = new Command('config').description('Manage agentflow configuration');

  cmd.command('get <key>')
    .description('Get a config value (e.g. defaults.provider)')
    .action((key: string) => {
      const config = loadConfig();
      const parts = key.split('.');
      let value: unknown = config;
      for (const part of parts) {
        value = (value as Record<string, unknown>)?.[part];
      }
      if (value === undefined) {
        console.log(`Key not found: ${key}`);
      } else {
        console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
      }
    });

  cmd.command('set <key> <value>')
    .description('Set a config value (e.g. defaults.provider anthropic)')
    .action((key: string, value: string) => {
      const config = loadConfig();
      const parts = key.split('.');
      let obj: Record<string, unknown> = config as unknown as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]!]) obj[parts[i]!] = {};
        obj = obj[parts[i]!] as Record<string, unknown>;
      }
      obj[parts[parts.length - 1]!] = value;
      saveConfig(config);
      console.log(`Set ${key} = ${value}`);
    });

  cmd.command('set-prompt <agentName> <prompt>')
    .description('Set a custom system prompt for an agent')
    .action((agentName: string, prompt: string) => {
      const config = loadConfig();
      if (!config.agents[agentName]) {
        const agents = listAgents();
        const agent = agents.find((a) => a.name === agentName);
        if (!agent) {
          console.error(`Agent not found: ${agentName}`);
          process.exit(1);
        }
        config.agents[agentName] = { ...agent };
      }
      config.agents[agentName]!.prompt = prompt;
      saveConfig(config);
      console.log(`Updated system prompt for agent: ${agentName}`);
    });

  cmd.command('show')
    .description('Show full config')
    .action(() => {
      const config = loadConfig();
      console.log(JSON.stringify(config, null, 2));
    });

  return cmd;
}
