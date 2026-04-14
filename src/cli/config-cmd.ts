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

  cmd.command('reset')
    .description('Reset config to defaults (keeps auth credentials)')
    .action(async () => {
      const { saveConfig } = await import('../config/index.ts');
      saveConfig({
        providers: {},
        agents: {},
        defaults: { provider: '', model: '', namespace: 'default' },
      });
      console.log('Config reset to defaults.');
    });

  cmd.command('models')
    .description('List all available models by provider')
    .action(async () => {
      const { MODEL_CATALOG } = await import('../provider/models.ts');
      const { TIER_ALIASES } = await import('../provider/models.ts');
      const providers = ['anthropic', 'google', 'openai'];
      for (const provider of providers) {
        const models = MODEL_CATALOG.filter(m => String(m.providerId) === provider);
        console.log(`\n${provider.toUpperCase()}`);
        console.log('─'.repeat(60));
        for (const m of models) {
          const tier = Object.entries(TIER_ALIASES[provider] ?? {})
            .find(([, id]) => String(id) === String(m.id))?.[0] ?? '';
          const tierBadge = tier ? ` [${tier}]` : '';
          const streaming = m.supportsStreaming ? '~' : ' ';
          const ctx = m.contextWindow >= 1_000_000
            ? `${m.contextWindow / 1_000_000}M`
            : `${m.contextWindow / 1_000}k`;
          console.log(`  ${streaming} ${String(m.id).padEnd(32)} ${m.name.padEnd(20)} ctx:${ctx}${tierBadge}`);
        }
      }
      console.log('\n  ~ = supports streaming');
    });

  return cmd;
}
