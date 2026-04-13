import { useState } from 'react';
import { Box, useInput, useApp } from 'ink';
import { MOCK_AGENTS } from './mock-data.ts';
import { StatusBar } from './components/StatusBar.tsx';
import { AgentTable } from './components/AgentTable.tsx';
import { AgentDetail } from './components/AgentDetail.tsx';
import { NamespaceFilter } from './components/NamespaceFilter.tsx';
import { CommandBar } from './components/CommandBar.tsx';
import { parseCommand } from '../orchestrator/manual.ts';
import { submitTask } from '../orchestrator/lifecycle.ts';
import { broadcast } from '../agent/broadcast.ts';

type View = 'table' | 'detail';

export function App() {
  const { exit } = useApp();
  const [agents] = useState(MOCK_AGENTS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [namespaceFilter, setNamespaceFilter] = useState('all');
  const [view, setView] = useState<View>('table');

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

  async function handleCommand(input: string) {
    const parsed = parseCommand(input);
    if (parsed.type === 'system') {
      const cmd = parsed.command ?? '';
      if (cmd === 'quit' || cmd === 'q') exit();
      else if (cmd.startsWith('ns ')) {
        setNamespaceFilter(cmd.slice(3).trim() || 'all');
        setSelectedIndex(0);
      }
      else if (cmd.startsWith('broadcast ')) broadcast('user', cmd.slice(10).trim());
    } else if (parsed.type === 'manual' && parsed.task) {
      await submitTask(parsed.task, parsed.agentName);
    } else if (parsed.type === 'auto' && parsed.task) {
      await submitTask(parsed.task);
    }
  }

  const activeTaskCount = agents.filter(a => a.status === 'running').length;

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar agentCount={agents.length} activeTaskCount={activeTaskCount} />
      <Box flexGrow={1}>
        {view === 'table' ? (
          <AgentTable agents={filteredAgents} selectedIndex={selectedIndex} />
        ) : (
          <AgentDetail agent={filteredAgents[selectedIndex]!} />
        )}
      </Box>
      <NamespaceFilter namespace={namespaceFilter} />
      <CommandBar onSubmit={handleCommand} placeholder="Type a task or :command..." />
    </Box>
  );
}
