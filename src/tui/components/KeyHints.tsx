import { Box, Text } from 'ink';

export function KeyHints() {
  return (
    <Box paddingX={1}>
      <Text dimColor>
        {'↑↓'} navigate{'  '}
        {'Enter'} detail{'  '}
        {'Esc'} back{'  '}
        {':q'} quit{'  '}
        {':ns <name>'} filter namespace{'  '}
        {'@agent <task>'} assign{'  '}
        {'공지! <msg>'} broadcast
      </Text>
    </Box>
  );
}
