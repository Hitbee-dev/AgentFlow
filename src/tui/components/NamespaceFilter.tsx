import { Box, Text } from 'ink';

interface NamespaceFilterProps {
  namespace: string;
  available?: string[];
}

export function NamespaceFilter({ namespace, available = [] }: NamespaceFilterProps) {
  const namespaces = ['all', ...new Set(available)];

  return (
    <Box paddingX={1}>
      <Text bold dimColor>NS: </Text>
      {namespaces.map(ns => {
        const active = ns === namespace;
        return (
          <Box key={ns} marginRight={1}>
            <Text
              bold={active}
              color={active ? 'cyan' : undefined}
              dimColor={!active}
            >
              {active ? `[${ns}]` : ns}
            </Text>
          </Box>
        );
      })}
      <Text dimColor>  :ns {'<name>'} to filter</Text>
    </Box>
  );
}
