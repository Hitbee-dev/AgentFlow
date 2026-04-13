import { useEffect, useState, useCallback } from 'react';
import { Box, Text as InkText, useInput, useApp } from 'ink';
import { listAgents } from '../agent/registry.ts';
import { readHeartbeat } from '../agent/heartbeat.ts';
import { authRegistry } from '../auth/registry.ts';
import type { AgentRow } from './mock-data.ts';
import { StatusBar } from './components/StatusBar.tsx';
import { AgentTable } from './components/AgentTable.tsx';
import { AgentDetail } from './components/AgentDetail.tsx';
import { NamespaceFilter } from './components/NamespaceFilter.tsx';
import { CommandBar } from './components/CommandBar.tsx';
import { parseCommand } from '../orchestrator/manual.ts';
import { submitTask } from '../orchestrator/lifecycle.ts';
import { broadcast } from '../agent/broadcast.ts';

type View = 'table' | 'detail';

function loadLiveAgents(): AgentRow[] {
  return listAgents().map(agent => {
    const hb = readHeartbeat(agent.name);
    return {
      name: agent.name,
      status: hb?.status ?? 'stopped',
      task: hb?.taskId ?? '—',
      provider: agent.provider,
      namespace: agent.namespace,
      model: agent.model,
    };
  });
}

export function App() {
  const { exit } = useApp();
  const [agents, setAgents] = useState<AgentRow[]>(loadLiveAgents);
  const [providerCount, setProviderCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [namespaceFilter, setNamespaceFilter] = useState('all');
  const [view, setView] = useState<View>('table');
  const [statusMsg, setStatusMsg] = useState('');

  // Refresh agents + providers every 1s
  useEffect(() => {
    const refresh = async () => {
      setAgents(loadLiveAgents());
      const statuses = await authRegistry.getStatus();
      setProviderCount(statuses.filter(s => s.isValid).length);
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredAgents = namespaceFilter === 'all'
    ? agents
    : agents.filter(a => a.namespace === namespaceFilter);

  useInput((_input, key) => {
    if (view === 'table') {
      if (key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
      if (key.downArrow) setSelectedIndex(i => Math.min(filteredAgents.length - 1, i + 1));
      if (key.return && filteredAgents[selectedIndex]) setView('detail');
    }
    if (view === 'detail') {
      if (key.escape) setView('table');
    }
  });

  const handleCommand = useCallback(async (input: string) => {
    const parsed = parseCommand(input);
    if (parsed.type === 'system') {
      const cmd = parsed.command ?? '';
      if (cmd === 'quit' || cmd === 'q') exit();
      else if (cmd.startsWith('ns ')) {
        const ns = cmd.slice(3).trim() || 'all';
        setNamespaceFilter(ns);
        setSelectedIndex(0);
        setStatusMsg(`Namespace filter: ${ns}`);
      } else if (cmd.startsWith('broadcast ')) {
        const msg = cmd.slice(10).trim();
        broadcast('user', msg);
        setStatusMsg(`Broadcast sent: ${msg}`);
      }
    } else if (parsed.type === 'manual' && parsed.task) {
      const taskId = await submitTask(parsed.task, parsed.agentName);
      setStatusMsg(`Task ${taskId.slice(0, 8)} → ${parsed.agentName}`);
    } else if (parsed.type === 'auto' && parsed.task) {
      const taskId = await submitTask(parsed.task);
      setStatusMsg(`Task ${taskId.slice(0, 8)} submitted`);
    }
  }, [exit]);

  const activeTaskCount = agents.filter(a => a.status === 'running').length;

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar
        agentCount={agents.length}
        activeTaskCount={activeTaskCount}
        providerCount={providerCount}
      />
      <Box flexGrow={1}>
        {view === 'table' ? (
          <AgentTable agents={filteredAgents} selectedIndex={selectedIndex} />
        ) : (
          <AgentDetail agent={filteredAgents[selectedIndex]!} />
        )}
      </Box>
      <NamespaceFilter namespace={namespaceFilter} />
      {statusMsg ? (
        <Box paddingX={1}>
          <InkText color="green">{statusMsg}</InkText>
        </Box>
      ) : null}
      <CommandBar onSubmit={handleCommand} placeholder="Task or :q :ns <ns> @agent <task> 공지! <msg>" />
    </Box>
  );
}
