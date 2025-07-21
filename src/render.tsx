import * as colors from "@std/fmt/colors";
import byteSize from "byte-size";
import { Box, Text, measureElement, render, useApp, useInput } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DownloadOptions, State } from "./core/types";

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

const PanelView = ({ filename, total, loaded }: { filename: string; total: number; loaded: number }) => {
  const startTime = useMemo(() => Date.now(), []);
  const speed = byteSize(loaded / ((Date.now() - startTime) / 1000) || 0) + "/s";
  const totalByteResult = useMemo(() => byteSize(total), [total]);
  const percent = total === 0 ? 0 : loaded / total;
  return (
    <Box flexDirection="column" borderStyle="round" gap={1}>
      <Box flexDirection="row" gap={1}>
        <Text color="gray">File: {colors.blue(filename)}</Text>
        <Text color="gray">Speed: {colors.green(speed)}</Text>
      </Box>
      <Box flexDirection="row" justifyContent="space-between">
        <ProgressBar percent={percent} />
        <Box marginLeft={1} minWidth={20} justifyContent="flex-end">
          <Text color="green">
            {byteSize(loaded, { precision: 1 }).toString()}
            {" / "}
            {totalByteResult.toString()}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

interface MainViewProps {
  doDownloadFunc: DoDownloadFunc;
  options: DownloadOptions;
}

const MainView = ({ doDownloadFunc, options }: MainViewProps) => {
  const { exit } = useApp();
  useInput((input, key) => {
    if (input === "c" && (key.ctrl || key.meta)) {
      exit();
    }
  });

  const [filename, setFilename] = useState("");
  const [total, setTotal] = useState(1);
  const [loaded, setLoaded] = useState(0);
  const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const aborter = new AbortController();
    let currentDownloadSize = 0;
    let currentTotalSize = 1;

    doDownloadFunc({
      ...options,
      signal: aborter.signal,
      emitter: (state: State) => {
        if (state.type === "start") {
          setFilename(state.filename);
          currentTotalSize = state.total > 0 ? state.total : 1; // Avoid division by zero
          setTotal(currentTotalSize);
          currentDownloadSize = 0;
          setLoaded(currentDownloadSize);
        } else if (state.type === "progress") {
          currentDownloadSize += state.chunkSize;
          setLoaded(currentDownloadSize);
          if (currentDownloadSize >= currentTotalSize) {
            setDownloadedFiles((prev) => [...prev, state.filename]);
          }
        } else if (state.type === "done") {
          setDone(true);
          setTimeout(() => exit(), 500); // Delay exit to show final state
        }
      },
    }).catch((error) => {
      // In case of error, exit gracefully
      console.error("\x1b[31m%s\x1b[0m", `\n[grab] Download failed: ${error.message}`);
      exit();
    });

    return () => aborter.abort("cancel");
  }, [doDownloadFunc, options, exit]);

  return (
    <Box flexDirection="column" gap={1}>
      {downloadedFiles.map((file, i) => (
        <Text key={i} color="green">
          ✅ Downloaded: {colors.blue(file)}
        </Text>
      ))}
      {done ? (
        <Text color="green">All tasks completed successfully!</Text>
      ) : filename ? (
        <PanelView filename={filename} total={total} loaded={loaded} />
      ) : (
        <Text>Initializing...</Text>
      )}
    </Box>
  );
};

export default function fetchRender(doDownloadFunc: DoDownloadFunc, options: DownloadOptions) {
  render(<MainView doDownloadFunc={doDownloadFunc} options={options} />);
}
