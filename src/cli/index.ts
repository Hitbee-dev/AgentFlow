#!/usr/bin/env bun
import { Command } from 'commander';
import { buildAuthCommand } from './auth.ts';
import { buildAgentsCommand } from './agents.ts';
import { buildConfigCommand } from './config-cmd.ts';


const program = new Command();
program
  .name('agentflow')
  .description('Multi-agent CLI orchestrator — k9s-style monitoring for AI agents')
  .version('0.0.1');

// Auth subcommands
program.addCommand(buildAuthCommand());

// Agents subcommand
program.addCommand(buildAgentsCommand());

// Config subcommands
program.addCommand(buildConfigCommand());

// Install command
program.command('install')
  .description('Set up agentflow from scratch (tmux check, auth, config)')
  .action(async () => {
    const { ensureConfigDir } = await import('../config/index.ts');
    const { ensureGitignore } = await import('../config/gitignore.ts');

    console.log('AgentFlow Setup Wizard');
    console.log('======================');

    // 1. Ensure directories
    ensureConfigDir();
    console.log('✓ Created .agent-cli/ directories');

    // 2. Ensure gitignore
    ensureGitignore();
    console.log('✓ Updated .gitignore');

    // 3. Check tmux
    const tmuxCheck = Bun.spawnSync(['tmux', '-V']);
    if (tmuxCheck.exitCode === 0) {
      console.log('✓ tmux is available');
    } else {
      console.log('✗ tmux not found — install with: brew install tmux (macOS) or apt install tmux (Linux)');
    }

    // 4. Auth prompt
    console.log('\nNext: run `agentflow auth login` to connect Claude');
    console.log('Or:   `agentflow auth add --provider openai --key sk-xxx`');
    console.log('\nSetup complete!');
  });

// Pipeline command
program
  .command('pipeline')
  .description('Manage automated dev pipeline (branch→plan→work→review→QA→PR)')
  .addCommand(
    new Command('start')
      .argument('<description>', 'Feature description')
      .description('Start a new pipeline')
      .action(async (description: string) => {
        const { startPipeline } = await import('../pipeline/index.ts');
        console.log(`Starting pipeline for: ${description}`);
        const pipeline = await startPipeline(description);
        console.log(`Pipeline ${pipeline.id} started on branch ${pipeline.branch}`);
      })
  )
  .addCommand(
    new Command('status')
      .argument('[id]', 'Pipeline ID')
      .description('Show pipeline status')
      .action(async (id?: string) => {
        const { getActivePipelines, getPipelineStatus } = await import('../pipeline/index.ts');
        if (id) {
          const p = getPipelineStatus(id);
          if (!p) { console.log('Pipeline not found'); return; }
          console.log(`${p.id}  ${p.status}  ${p.currentStage}  ${p.branch}`);
        } else {
          const active = getActivePipelines();
          if (!active.length) { console.log('No active pipelines'); return; }
          active.forEach(p => console.log(`${p.id}  ${p.status}  ${p.currentStage}  ${p.branch}`));
        }
      })
  )
  .addCommand(
    new Command('cancel')
      .argument('<id>', 'Pipeline ID')
      .description('Cancel a running pipeline')
      .action(async (id: string) => {
        const { cancelPipeline } = await import('../pipeline/index.ts');
        cancelPipeline(id);
        console.log(`Pipeline ${id} cancelled`);
      })
  );

// TUI command
program
  .command('tui')
  .description('Launch the k9s-style agent dashboard (default)')
  .action(() => {
    import('../tui/index.ts').then(({ startTUI }) => startTUI());
  });

// Default action: launch TUI when no subcommand given
program.action(() => {
  import('../tui/index.ts').then(({ startTUI }) => startTUI());
});

program.parse();
