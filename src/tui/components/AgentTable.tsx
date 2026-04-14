import { Box, Text } from 'ink';
import type { AgentRow } from '../mock-data.ts';
import type { AgentStatus } from '../../types/index.ts';

interface AgentTableProps {
  agents: AgentRow[];
  selectedIndex: number;
}

function statusColor(status: AgentStatus): string {
  switch (status) {
    case 'running': return 'green';
    case 'idle': return 'yellow';
    case 'error': return 'red';
    case 'stopped': return 'gray';
  }
}

function statusLabel(status: AgentStatus): string {
  switch (status) {
    case 'running': return 'RUNNING';
    case 'idle':    return 'IDLE   ';
    case 'error':   return 'ERROR  ';
    case 'stopped': return 'STOPPED';
  }
}

function padEnd(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

export function AgentTable({ agents, selectedIndex }: AgentTableProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <Box paddingX={1}>
        <Text bold>
          {'  '}
          {padEnd('NAME', 12)}
          {padEnd('STATUS', 10)}
          {padEnd('TASK', 30)}
          {padEnd('PROVIDER', 12)}
          {'NAMESPACE'}
        </Text>
      </Box>
      <Box paddingX={1}>
        <Text dimColor>{'─'.repeat(80)}</Text>
      </Box>
      {/* Rows */}
      {agents.map((agent, i) => {
        const selected = i === selectedIndex;
        const marker = selected ? '> ' : '  ';
        return (
          <Box key={agent.name} paddingX={1}>
            <Text inverse={selected}>
              {marker}
              {padEnd(agent.name, 12)}
            </Text>
            <Text color={statusColor(agent.status)} inverse={selected}>
              {'['}
              {statusLabel(agent.status)}
              {'] '}
            </Text>
            <Text inverse={selected}>
              {padEnd(agent.task, 30)}
              {padEnd(agent.provider, 12)}
              {agent.namespace}
            </Text>
          </Box>
        );
      })}
      {agents.length === 0 && (
        <Box paddingX={3}>
          <Text dimColor>No agents match the current filter.</Text>
        </Box>
      )}
      <Box paddingX={1} marginTop={1}>
        <Text dimColor>↑/↓ navigate  Enter detail  Esc back</Text>
      </Box>
    </Box>
  );
}
