import { Box, Text } from 'ink';

interface StatusBarProps {
  agentCount: number;
  activeTaskCount: number;
}

export function StatusBar({ agentCount, activeTaskCount }: StatusBarProps) {
  return (
    <Box borderStyle="single" paddingX={1}>
      <Text bold color="cyan">AgentFlow v0.0.1</Text>
      <Text>  |  </Text>
      <Text>Providers: 0 connected</Text>
      <Text>  |  </Text>
      <Text>Agents: {agentCount}</Text>
      <Text>  |  </Text>
      <Text>Tasks: {activeTaskCount} active</Text>
    </Box>
  );
}
