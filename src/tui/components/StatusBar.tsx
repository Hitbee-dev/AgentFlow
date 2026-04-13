import { Box, Text } from 'ink';

interface StatusBarProps {
  agentCount: number;
  activeTaskCount: number;
  providerCount: number;
}

export function StatusBar({ agentCount, activeTaskCount, providerCount }: StatusBarProps) {
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });
  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between">
      <Box>
        <Text bold color="cyan">AgentFlow</Text>
        <Text dimColor> v0.0.1  |  </Text>
        <Text color={providerCount > 0 ? 'green' : 'yellow'}>
          {providerCount > 0 ? '●' : '○'} {providerCount} provider{providerCount !== 1 ? 's' : ''}
        </Text>
        <Text dimColor>  |  </Text>
        <Text>
          {agentCount} agent{agentCount !== 1 ? 's' : ''}
        </Text>
        <Text dimColor>  |  </Text>
        <Text color={activeTaskCount > 0 ? 'green' : undefined}>
          {activeTaskCount} active
        </Text>
      </Box>
      <Text dimColor>{now}</Text>
    </Box>
  );
}
