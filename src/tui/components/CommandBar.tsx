import { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface CommandBarProps {
  onSubmit: (input: string) => void | Promise<void>;
  placeholder?: string;
}

export function CommandBar({ onSubmit, placeholder = 'Type a task or :command...' }: CommandBarProps) {
  const [value, setValue] = useState('');

  function handleSubmit(input: string) {
    onSubmit(input);
    setValue('');
  }

  return (
    <Box flexDirection="column">
      <Box paddingX={1}>
        <Text dimColor>Hints: </Text>
        <Text dimColor>:ns {'<name>'} filter  </Text>
        <Text dimColor>:quit exit  </Text>
        <Text dimColor>@agent {'<task>'} assign</Text>
      </Box>
      <Box borderStyle="single" paddingX={1}>
        <Text bold color="cyan">{'> '}</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      </Box>
    </Box>
  );
}
