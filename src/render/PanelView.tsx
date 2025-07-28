import byteSize from "byte-size";
import { Box, Text } from "ink";
import React from "react";
import type { DownloadTaskState } from "../core/types";
import { ProgressBar } from "./ProgressBar";
import { StatusDisplay } from "./StatusDisplay";

export const PanelView: React.FC<{ task: DownloadTaskState }> = ({ task }) => {
  const { filename, total, loaded, url } = task;
  const percent = total > 0 ? loaded / total : 0;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} gap={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text color="cyan">{filename}</Text>
        <StatusDisplay {...task} />
      </Box>
      <Text color="gray" dimColor>
        {url}
      </Text>
      <Box flexDirection="row" gap={1}>
        <ProgressBar percent={percent} />
        <Box minWidth={22} justifyContent="flex-end">
          <Text>
            {byteSize(loaded, { precision: 1 }).toString()} / {byteSize(total).toString()}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
