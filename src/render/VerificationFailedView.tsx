import { Box, Text } from "ink";
import React from "react";
import type { DownloadTaskState } from "../core/types";
import { StatusDisplay } from "./StatusDisplay";

export const VerificationFailedView: React.FC<{ task: DownloadTaskState }> = ({ task }) => {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} gap={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text color="cyan">{task.filename}</Text>
        <StatusDisplay {...task} />
      </Box>
      <Text color="gray" dimColor>
        {task.url}
      </Text>
      {task.error && (
        <Box flexDirection="column" gap={1}>
          <Text color="red">Hash mismatch detected:</Text>
          <Text color="red">- Expected: {task.error.message.split("expected ")[1]?.split(", got")[0]}</Text>
          <Text color="red">- Actual: {task.error.message.split("got ")[1]}</Text>
        </Box>
      )}
    </Box>
  );
};
