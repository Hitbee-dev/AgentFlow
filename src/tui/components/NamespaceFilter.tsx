import { Text } from 'ink';

interface NamespaceFilterProps {
  namespace: string;
}

export function NamespaceFilter({ namespace }: NamespaceFilterProps) {
  return (
    <Text>
      <Text bold>Namespace: </Text>
      <Text color="yellow">{namespace}</Text>
    </Text>
  );
}
