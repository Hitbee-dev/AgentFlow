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

export function AgentDetail({ agent }: AgentDetailProps) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Agent Detail</Text>
      </Box>
      <Box flexDirection="column" borderStyle="single" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text bold>Name:      </Text>
          <Text>{agent.name}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text bold>Status:    </Text>
          <Text color={statusColor(agent.status)}>{agent.status.toUpperCase()}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text bold>Provider:  </Text>
          <Text>{agent.provider}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text bold>Namespace: </Text>
          <Text>{agent.namespace}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text bold>Task:      </Text>
          <Text>{agent.task}</Text>
        </Box>
      </Box>
      <Box marginTop={1} marginBottom={1}>
        <Text bold color="cyan">Tmux Output (last 20 lines)</Text>
      </Box>
      <Box borderStyle="single" paddingX={2} paddingY={1} flexGrow={1}>
        <Text dimColor>[tmux output will appear here]</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Esc to go back</Text>
      </Box>
    </Box>
  );
}
