import * as colors from "@std/fmt/colors";
import byteSize from "byte-size";
import { Box, Text, measureElement, render, useApp, useInput } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DownloadOptions, DownloadTaskState, EmitterState } from "./core/types";

type DoDownloadFunc = (options: DownloadOptions) => Promise<void>;

const ProgressBar = ({ percent }: { percent: number }) => {
  const ref = useRef<any>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (ref.current) {
      const { width: measuredWidth } = measureElement(ref.current);
      setWidth(measuredWidth);
    }
  }, []);

  let content = "";
  if (width > 0) {
    const loaded = Math.max(0, Math.round(percent * width));
    const rest = Math.max(0, width - loaded);
    content = colors.cyan("█".repeat(loaded) + "░".repeat(rest));
  }

  return (
    <Box flexGrow={1} height={1} ref={ref}>
      <Text>{content}</Text>
    </Box>
  );
};

const StatusDisplay = ({ status, error, retryCount }: DownloadTaskState) => {
  switch (status) {
    case "pending":
      return <Text color="gray">Pending...</Text>;
    case "downloading":
      return <Text color="blue">Downloading...</Text>;
    case "verifying":
      return <Text color="yellow">Verifying...</Text>;
    case "retrying":
      return <Text color="yellow">Retrying ({retryCount})... Error: {error?.message}</Text>;
    case "failed":
      return <Text color="red">Failed: {error?.message}</Text>;
    case "succeeded":
      return <Text color="green">Succeeded</Text>;
    default:
      return null;
  }
};

const PanelView = ({ task }: { task: DownloadTaskState }) => {
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

const MainView = ({ doDownloadFunc, options }: { doDownloadFunc: DoDownloadFunc; options: DownloadOptions }) => {
  const { exit } = useApp();
  useInput((input, key) => {
    if (input === "c" && (key.ctrl || key.meta)) {
      exit();
    }
  });

  const [tasks, setTasks] = useState<Record<string, DownloadTaskState>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    const aborter = new AbortController();

    doDownloadFunc({
      ...options,
      signal: aborter.signal,
      emitter: (state: EmitterState) => {
        if (state.status === "done") {
          setDone(true);
          setTimeout(() => exit(), 500);
          return;
        }
        setTasks((prev) => ({
          ...prev,
          [state.url]: state,
        }));
      },
    }).catch((error) => {
      console.error("\n" + colors.red(`[grab] Download failed: ${error.message}`));
      exit(error);
    });

    return () => aborter.abort("cancel");
  }, [doDownloadFunc, options, exit]);

  const taskList = Object.values(tasks);
  const succeeded = taskList.filter((t) => t.status === "succeeded");
  const failed = taskList.filter((t) => t.status === "failed");
  const inProgress = taskList.filter((t) => t.status !== "succeeded" && t.status !== "failed");

  return (
    <Box flexDirection="column" gap={1}>
      {inProgress.map((task) => (
        <PanelView key={task.url} task={task} />
      ))}
      {done && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green">✅ All tasks completed.</Text>
          <Text>
            - {succeeded.length} succeeded, {failed.length} failed.
          </Text>
          {failed.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="red">Failed Tasks:</Text>
              {failed.map((task) => (
                <Text key={task.url}>
                  - {task.filename}: {task.error?.message}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default function fetchRender(doDownloadFunc: DoDownloadFunc, options: DownloadOptions) {
  render(<MainView doDownloadFunc={doDownloadFunc} options={options} />);
}
