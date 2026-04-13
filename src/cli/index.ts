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

// agentflow run <task> [--agent <name>]
program
  .command('run')
  .argument('<task>', 'Task description to submit')
  .description('Submit a task to an agent (auto-assigned or manual)')
  .option('--agent <name>', 'Target a specific agent by name')
  .option('--wait', 'Wait for task completion and stream output')
  .action(async (task: string, opts: { agent?: string; wait?: boolean }) => {
    const { submitTask } = await import('../orchestrator/lifecycle.ts');
    try {
      const taskId = await submitTask(task, opts.agent);
      console.log(`Task submitted: ${taskId}`);
      if (opts.agent) {
        console.log(`  Assigned to: ${opts.agent}`);
      }
      console.log(`  Description: ${task}`);
      console.log(`\n  Track progress: agentflow tasks show ${taskId}`);
      console.log(`  Watch TUI:      agentflow tui`);

      if (opts.wait) {
        const { getTask } = await import('../agent/tasks.ts');
        process.stdout.write('  Waiting');
        while (true) {
          await Bun.sleep(1000);
          const t = getTask(taskId);
          if (!t) break;
          if (t.state === 'completed' || t.state === 'failed') {
            process.stdout.write('\n');
            console.log(`  Status: ${t.state}`);
            break;
          }
          process.stdout.write('.');
        }
      }
    } catch (err) {
      console.error(`Failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// agentflow tasks [list|show|cancel]
const tasksCmd = program
  .command('tasks')
  .description('Manage tasks');

tasksCmd
  .command('list')
  .alias('ls')
  .description('List all tasks')
  .option('--state <state>', 'Filter by state (pending|assigned|running|completed|failed)')
  .action(async (opts: { state?: string }) => {
    const { listTasks } = await import('../agent/tasks.ts');
    const tasks = listTasks(opts.state as Parameters<typeof listTasks>[0]);
    if (!tasks.length) {
      console.log('No tasks found.');
      return;
    }
    const header = ['ID', 'STATE', 'AGENT', 'DESCRIPTION'];
    const rows = tasks.map(t => [
      t.id.slice(0, 8),
      t.state,
      t.assignedAgent ?? '—',
      t.description.slice(0, 50),
    ]);
    const colWidths = header.map((h, i) => Math.max(h.length, ...rows.map(r => r[i]!.length)));
    const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(colWidths[i]!)).join('  ');
    console.log(fmt(header));
    console.log(colWidths.map(w => '-'.repeat(w)).join('  '));
    for (const row of rows) console.log(fmt(row));
  });

tasksCmd
  .command('show <id>')
  .description('Show task details')
  .action(async (id: string) => {
    const { listTasks, getTask } = await import('../agent/tasks.ts');
    // Support short ID prefix
    let task = getTask(id);
    if (!task) {
      const all = listTasks();
      task = all.find(t => t.id.startsWith(id)) ?? null;
    }
    if (!task) {
      console.error(`Task not found: ${id}`);
      process.exit(1);
    }
    console.log(JSON.stringify(task, null, 2));
  });

tasksCmd
  .command('cancel <id>')
  .description('Cancel a pending task')
  .action(async (id: string) => {
    const { getTask, updateTask, listTasks } = await import('../agent/tasks.ts');
    let task = getTask(id);
    if (!task) {
      const all = listTasks();
      task = all.find(t => t.id.startsWith(id)) ?? null;
    }
    if (!task) {
      console.error(`Task not found: ${id}`);
      process.exit(1);
    }
    if (task.state === 'running') {
      console.error(`Task ${task.id} is running — cannot cancel a running task`);
      process.exit(1);
    }
    updateTask(task.id, { state: 'failed' });
    console.log(`Task ${task.id.slice(0, 8)} cancelled`);
  });

// agentflow agent-worker <name>  (internal: runs inside tmux session)
program
  .command('agent-worker <name>')
  .description('Run agent worker process (called internally by tmux sessions)')
  .action(async (name: string) => {
    // Dynamically import to avoid circular deps in normal CLI startup
    const { getAgent } = await import('../agent/registry.ts');
    const { writeHeartbeat, startHeartbeat, stopHeartbeat } = await import('../agent/heartbeat.ts');
    const { dequeue } = await import('../agent/dispatch.ts');
    const { getTask } = await import('../agent/tasks.ts');
    const { runAgent } = await import('../agent/execution.ts');

    const agent = getAgent(name);
    if (!agent) {
      console.error(`Agent "${name}" not found in registry`);
      process.exit(1);
    }

    console.log(`[agentflow-worker] Starting agent: ${name} (${agent.model})`);
    writeHeartbeat({ agentName: name, status: 'idle', timestamp: new Date().toISOString() });
    const hbTimer = startHeartbeat(name, 'idle');

    const shutdown = () => {
      stopHeartbeat(hbTimer);
      writeHeartbeat({ agentName: name, status: 'stopped', timestamp: new Date().toISOString() });
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    while (true) {
      try {
        const entry = dequeue();
        if (entry && (entry.targetAgent === name || !entry.targetAgent)) {
          const task = getTask(entry.taskId);
          if (task && (task.state === 'pending' || task.state === 'assigned')) {
            console.log(`[agentflow-worker] Task ${task.id.slice(0, 8)}: ${task.description}`);
            stopHeartbeat(hbTimer);
            await runAgent({ agentName: name, task });
            startHeartbeat(name, 'idle');
            console.log(`[agentflow-worker] Task ${task.id.slice(0, 8)} done`);
          }
        }
      } catch (err) {
        console.error(`[agentflow-worker] Error:`, err);
      }
      await Bun.sleep(2000);
    }
  });

// Default action: launch TUI when no subcommand given
program.action(() => {
  import('../tui/index.ts').then(({ startTUI }) => startTUI());
});

program.parse();
