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
      .argument('[id]', 'Pipeline ID (or prefix)')
      .description('Show pipeline status')
      .action(async (id?: string) => {
        const { getActivePipelines, getPipelineStatus } = await import('../pipeline/index.ts');
        const { getGateResult } = await import('../pipeline/gates.ts');
        const GATES = ['security-review', 'code-review', 'qa-test'];

        const printPipeline = (p: Awaited<ReturnType<typeof getPipelineStatus>>) => {
          if (!p) return;
          const statusColor: Record<string, string> = { running: '🔵', completed: '✅', failed: '❌', cancelled: '⭕' };
          console.log(`\nPipeline: ${p.id.slice(0, 8)}`);
          console.log(`  Branch:  ${p.branch}`);
          console.log(`  Status:  ${statusColor[p.status] ?? ''} ${p.status}`);
          console.log(`  Stage:   ${p.currentStage}`);
          console.log(`  Started: ${new Date(p.createdAt).toLocaleString()}`);
          console.log(`\n  Gates:`);
          for (const gate of GATES) {
            const result = getGateResult(p.id, gate);
            const icon = result?.status === 'pass' ? '✓' : result?.status === 'fail' ? '✗' : '…';
            const status = result?.status ?? 'pending';
            console.log(`    ${icon} ${gate.padEnd(16)} ${status}`);
          }
        };

        if (id) {
          // Support prefix matching
          let p = getPipelineStatus(id);
          if (!p) {
            const all = getActivePipelines();
            p = all.find(x => x.id.startsWith(id)) ?? null;
          }
          if (!p) { console.log('Pipeline not found'); return; }
          printPipeline(p);
        } else {
          const active = getActivePipelines();
          if (!active.length) { console.log('No active pipelines'); return; }
          for (const p of active) printPipeline(p);
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
  )
  .addCommand(
    new Command('list')
      .alias('ls')
      .description('List all pipelines (active and completed)')
      .action(async () => {
        const PIPELINE_DIR = '.agent-cli/pipeline';
        const { existsSync, readdirSync } = await import('fs');
        if (!existsSync(PIPELINE_DIR)) {
          console.log('No pipelines found.');
          return;
        }
        const ids = readdirSync(PIPELINE_DIR);
        if (!ids.length) { console.log('No pipelines found.'); return; }
        const { getPipelineStatus } = await import('../pipeline/index.ts');
        const pipelines = ids
          .map(id => getPipelineStatus(id))
          .filter(Boolean)
          .sort((a, b) => a!.createdAt.localeCompare(b!.createdAt));
        const statusIcon: Record<string, string> = {
          running: '🔵', completed: '✅', failed: '❌', cancelled: '⭕',
        };
        const header = ['ID', 'STATUS', 'STAGE', 'BRANCH'];
        const rows = pipelines.map(p => [
          p!.id.slice(0, 8),
          `${statusIcon[p!.status] ?? ''} ${p!.status}`,
          p!.currentStage,
          p!.branch.slice(0, 30),
        ]);
        if (!rows.length) { console.log('No pipelines found.'); return; }
        const widths = header.map((h, i) => Math.max(h.length, ...rows.map(r => r[i]!.length)));
        const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i]!)).join('  ');
        console.log(fmt(header));
        console.log(widths.map(w => '-'.repeat(w)).join('  '));
        for (const row of rows) console.log(fmt(row));
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
    const { listAgents } = await import('../agent/registry.ts');
    const { isAlive } = await import('../agent/heartbeat.ts');

    // Warn if no agents are running to process the task
    const aliveAgents = listAgents().filter(a => isAlive(a.name));
    if (!aliveAgents.length) {
      console.log('Warning: No agents are currently running. Task will queue until an agent starts.');
      console.log('  Start agents: agentflow agents start-all\n');
    }

    try {
      const taskId = await submitTask(task, opts.agent);
      console.log(`Task submitted: ${taskId.slice(0, 8)}`);
      if (opts.agent) {
        console.log(`  Assigned to: ${opts.agent}`);
      }
      console.log(`  Description: ${task}`);
      console.log(`\n  Track progress: agentflow tasks show ${taskId.slice(0, 8)}`);
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
    console.log(`ID:          ${task.id}`);
    console.log(`Description: ${task.description}`);
    console.log(`State:       ${task.state}`);
    console.log(`Agent:       ${task.assignedAgent ?? '—'}`);
    console.log(`Created:     ${task.createdAt}`);
    console.log(`Updated:     ${task.updatedAt}`);
    if (task.result) {
      console.log(`\nResult:\n${task.result}`);
    }
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

tasksCmd
  .command('archive')
  .description('Move completed and failed tasks to history')
  .action(async () => {
    const { archiveCompletedTasks } = await import('../orchestrator/lifecycle.ts');
    await archiveCompletedTasks();
    console.log('Archived completed and failed tasks to .agent-cli/history/');
  });

// agentflow chat <agent> <message...> — one-shot direct conversation
program
  .command('chat')
  .argument('<agent>', 'Agent name to chat with')
  .argument('<message...>', 'Message to send')
  .description('Send a one-shot message to an agent and stream the response')
  .option('--no-stream', 'Disable streaming, print full response at end')
  .action(async (agentName: string, words: string[], opts: { stream: boolean }) => {
    const { getAgent } = await import('../agent/registry.ts');
    const { chat } = await import('../provider/chat.ts');
    const { toModelID } = await import('../provider/types.ts');

    const agent = getAgent(agentName);
    if (!agent) {
      console.error(`Agent "${agentName}" not found. Run "agentflow agents list" to see available agents.`);
      process.exit(1);
    }

    const message = words.join(' ');
    console.error(`[${agent.name}/${agent.model}]`);

    try {
      let fullResponse = '';
      for await (const chunk of chat(
        [{ role: 'user', content: message }],
        { model: toModelID(agent.model), system: agent.prompt },
      )) {
        if (chunk.type === 'text') {
          fullResponse += chunk.text;
          if (opts.stream) process.stdout.write(chunk.text ?? '');
        }
      }
      if (!opts.stream) process.stdout.write(fullResponse);
      process.stdout.write('\n');
    } catch (err) {
      console.error(`Chat failed: ${(err as Error).message}`);
      console.error('Tip: run "agentflow auth login" or "agentflow auth add --provider openai --key sk-xxx"');
      process.exit(1);
    }
  });

// agentflow orchestrate <task> — start-all + run in one command
program
  .command('orchestrate')
  .alias('go')
  .argument('<task...>', 'Task to run')
  .description('Start all agents and submit a task (shortcut for start-all + run)')
  .option('--agent <name>', 'Target a specific agent')
  .option('--wait', 'Wait for task completion')
  .action(async (words: string[], opts: { agent?: string; wait?: boolean }) => {
    const { listAgents } = await import('../agent/registry.ts');
    const { isAlive } = await import('../agent/heartbeat.ts');
    const { tmuxManager } = await import('../agent/tmux-manager.ts');

    const task = words.join(' ');
    const agents = listAgents();
    const stopped = agents.filter(a => !isAlive(a.name));

    if (stopped.length > 0) {
      console.log(`Starting ${stopped.length} agent(s)...`);
      for (const agent of stopped) {
        const alive = tmuxManager.isSessionAlive(agent.name);
        if (!alive) {
          tmuxManager.createSession(agent.name, `agentflow agent-worker ${agent.name}`);
          console.log(`  ↑ ${agent.name}`);
        }
      }
      // Brief pause for workers to initialize
      await Bun.sleep(500);
    }

    const { submitTask } = await import('../orchestrator/lifecycle.ts');
    const taskId = await submitTask(task, opts.agent);
    console.log(`\nTask submitted: ${taskId.slice(0, 8)}`);
    console.log(`  ${task}`);
    if (opts.agent) console.log(`  → ${opts.agent}`);

    if (opts.wait) {
      const { getTask } = await import('../agent/tasks.ts');
      process.stdout.write('  Waiting');
      while (true) {
        await Bun.sleep(1000);
        const t = getTask(taskId);
        if (!t || t.state === 'completed' || t.state === 'failed') {
          process.stdout.write('\n');
          console.log(`  Status: ${t?.state ?? 'not found'}`);
          break;
        }
        process.stdout.write('.');
      }
    } else {
      console.log(`\n  Watch: agentflow  |  Logs: agentflow agents logs <name>`);
    }
  });

// agentflow broadcast <message>
program
  .command('broadcast')
  .argument('<message...>', 'Message to broadcast to all agents')
  .description('Send a broadcast message to all running agents')
  .action(async (words: string[]) => {
    const { broadcast } = await import('../agent/broadcast.ts');
    const message = words.join(' ');
    broadcast('user', message);
    console.log(`Broadcast sent: ${message}`);
  });

// agentflow doctor — diagnose system health
program
  .command('doctor')
  .description('Diagnose system health (tmux, auth, config, binary)')
  .action(async () => {
    let allOk = true;
    const check = (label: string, ok: boolean, detail?: string) => {
      const icon = ok ? '✓' : '✗';
      const color = ok ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      console.log(`  ${color}${icon}${reset} ${label}${detail ? `  (${detail})` : ''}`);
      if (!ok) allOk = false;
    };

    console.log('\nagentflow doctor\n');

    // 1. Binary in PATH
    const binaryPath = Bun.which('agentflow');
    check('agentflow in PATH', binaryPath !== null, binaryPath ?? 'not found');

    // 2. tmux
    const tmuxCheck = Bun.spawnSync(['tmux', '-V']);
    const tmuxVersion = new TextDecoder().decode(tmuxCheck.stdout).trim();
    check('tmux available', tmuxCheck.exitCode === 0, tmuxVersion || 'not found');

    // 3. Config file
    const { loadConfig } = await import('../config/index.ts');
    let configOk = false;
    try { loadConfig(); configOk = true; } catch { configOk = false; }
    check('config valid', configOk, '.agent-cli/config.json');

    // 4. Auth
    const { authRegistry } = await import('../auth/registry.ts');
    const statuses = await authRegistry.getStatus();
    const validProviders = statuses.filter(s => s.isValid);
    check(
      'at least one provider authenticated',
      validProviders.length > 0,
      validProviders.length > 0
        ? validProviders.map(s => s.provider).join(', ')
        : 'run: agentflow auth login',
    );

    // 5. Agents registered
    const { listAgents } = await import('../agent/registry.ts');
    const agents = listAgents();
    check('agents registered', agents.length > 0, `${agents.length} agents`);

    // 6. Agent sessions
    const { tmuxManager } = await import('../agent/tmux-manager.ts');
    const sessionChecks = await Promise.all(agents.map(a => tmuxManager.isSessionAlive(a.name)));
    const runningSessions = sessionChecks.filter(Boolean).length;
    check(
      'agent sessions',
      runningSessions > 0,
      runningSessions > 0 ? `${runningSessions}/${agents.length} running` : 'run: agentflow agents start-all',
    );

    console.log('');
    if (allOk) {
      console.log('  \x1b[32mAll checks passed\x1b[0m\n');
    } else {
      console.log('  \x1b[33mSome checks failed — see above for details\x1b[0m\n');
    }
  });

// agentflow status — quick overview of agents + tasks + auth
program
  .command('status')
  .description('Show a quick overview of agents, tasks, and auth')
  .action(async () => {
    const { listAgents } = await import('../agent/registry.ts');
    const { readHeartbeat, isAlive } = await import('../agent/heartbeat.ts');
    const { listTasks } = await import('../agent/tasks.ts');
    const { authRegistry } = await import('../auth/registry.ts');
    const { tmuxManager } = await import('../agent/tmux-manager.ts');

    console.log('\nAgentFlow Status');
    console.log('═'.repeat(50));

    // Agents
    const agents = listAgents();
    const agentRows = await Promise.all(
      agents.map(async a => {
        const hb = readHeartbeat(a.name);
        const sessionAlive = tmuxManager.isSessionAlive(a.name);
        const heartbeatAlive = isAlive(a.name);
        let status = 'stopped';
        if (sessionAlive && heartbeatAlive) status = 'running';
        else if (sessionAlive) status = 'session-only';
        return { name: a.name, status, task: hb?.taskId ?? '—', namespace: a.namespace };
      })
    );

    console.log('\n  Agents');
    for (const a of agentRows) {
      const icon = a.status === 'running' ? '●' : a.status === 'session-only' ? '◐' : '○';
      console.log(`    ${icon} ${a.name.padEnd(12)} ${a.status.padEnd(14)} ns:${a.namespace}`);
    }

    // Tasks
    const pending = listTasks('pending').length;
    const running = listTasks('running').length;
    const completed = listTasks('completed').length;
    const failed = listTasks('failed').length;

    console.log('\n  Tasks');
    console.log(`    pending: ${pending}  running: ${running}  completed: ${completed}  failed: ${failed}`);

    // Auth
    const authStatuses = await authRegistry.getStatus();
    console.log('\n  Auth');
    for (const s of authStatuses) {
      const icon = s.isValid ? '✓' : '✗';
      const method = s.authMethod === 'oauth' ? 'OAuth' : 'API key';
      console.log(`    ${icon} ${s.provider.padEnd(10)} ${method}`);
    }

    console.log('');
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
        const entry = dequeue(name);
        if (entry) {
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
