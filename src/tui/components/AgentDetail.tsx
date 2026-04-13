import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import type { AgentRow } from '../mock-data.ts';
import type { AgentStatus } from '../../types/index.ts';

interface AgentDetailProps {
  agent: AgentRow;
}

function statusColor(status: AgentStatus): string {
  switch (status) {
    case 'running': return 'green';
    case 'idle': return 'yellow';
    case 'error': return 'red';
    case 'stopped': return 'gray';
  }
}

async function captureTmuxPane(agentName: string, lines: number): Promise<string[]> {
  const proc = Bun.spawnSync([
    'tmux', 'capture-pane', '-p', '-t', `agentflow-${agentName}`, '-S', `-${lines}`,
  ]);
  if (proc.exitCode !== 0) return ['(no active session)'];
  const output = new TextDecoder().decode(proc.stdout).trimEnd();
  if (!output) return ['(no output yet)'];
  return output.split('\n').slice(-lines);
}

export function AgentDetail({ agent }: AgentDetailProps) {
  const [tmuxLines, setTmuxLines] = useState<string[]>(['Loading...']);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const lines = await captureTmuxPane(agent.name, 20);
      if (!cancelled) setTmuxLines(lines);
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [agent.name]);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">◀ Agent Detail</Text>
        <Text dimColor>  (Esc to go back)</Text>
      </Box>

      <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1}>
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>{'Name:      '}</Text>
            <Text color="cyan">{agent.name}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text bold>{'Status:    '}</Text>
            <Text color={statusColor(agent.status)}>{agent.status.toUpperCase()}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text bold>{'Model:     '}</Text>
            <Text>{agent.model}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text bold>{'Provider:  '}</Text>
            <Text>{agent.provider}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text bold>{'Namespace: '}</Text>
            <Text>{agent.namespace}</Text>
          </Box>
          <Box>
            <Text bold>{'Task:      '}</Text>
            <Text color={agent.task === '—' ? 'gray' : 'yellow'}>{agent.task}</Text>
          </Box>
        </Box>
      </Box>

      <Box marginBottom={1}>
        <Text bold color="cyan">Session Output</Text>
        <Text dimColor>  agentflow-{agent.name} (refreshes every 2s)</Text>
      </Box>
      <Box borderStyle="single" paddingX={2} paddingY={1} flexGrow={1} flexDirection="column">
        {tmuxLines.map((line, i) => (
          <Text key={i} dimColor={line.startsWith('(')}>
            {line || ' '}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
