import * as colors from "@std/fmt/colors";
import byteSize from "byte-size";
import { Box, Text, measureElement, render, useApp, useInput } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DownloadOptions, DownloadTaskState, EmitterState } from "./core/types";

// 定义任务操作类型
type TaskAction = "pending" | "retry" | "skip" | "reject";

// 定义任务操作状态
interface TaskActionState {
  url: string;
  action: TaskAction;
}

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
    case "verification_failed":
      return <Text color="red">Verification Failed</Text>;
    case "clearing_cache":
      return <Text color="yellow">Clearing Cache...</Text>;
    case "skipped":
      return <Text color="gray">Skipped</Text>;
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

const VerificationFailedView = ({ task }: { task: DownloadTaskState }) => {
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

const TaskItem = ({ 
  index,
  task, 
  isSelected, 
  currentAction,
  showActions,
  selectedAction
}: { 
  index: number;
  task: DownloadTaskState;
  isSelected: boolean;
  currentAction: TaskAction;
  showActions: boolean;
  selectedAction: TaskAction;
}) => {
  // 操作选项
  const actions: TaskAction[] = ["pending", "retry", "skip", "reject"];
  const actionLabels = {
    pending: "Pending",
    retry: "Retry",
    skip: "Skip",
    reject: "Reject"
  };
  const actionColors = {
    pending: "yellow",
    retry: "blue",
    skip: "gray",
    reject: "red"
  };

  return (
    <Box flexDirection="column">
      <Box 
        key={task.url} 
        flexDirection="row" 
        gap={1}
      >
        <Text color={isSelected ? "white" : "cyan"}>{isSelected ? "›" : " "}</Text>
        <Text color="gray">{index + 1}.</Text>
        <Text color={isSelected ? "white" : "cyan"} bold={isSelected}>{task.filename}</Text>
        <Box flexGrow={1} />
        <Text color={actionColors[currentAction]}>{actionLabels[currentAction]}</Text>
      </Box>
      {showActions && (
        <Box flexDirection="row" gap={0} paddingLeft={4}>
          <Text color="gray">Actions:</Text>
          {actions.map((act) => {
            const isActionSelected = act === selectedAction;
            return (
              <Text key={act} color={actionColors[act]} >
                {isActionSelected ? `[${actionLabels[act]}]` : ` ${actionLabels[act]} `}
              </Text>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

const SelectionPanel = ({ 
  verificationFailedTasks, 
  taskActions, 
  selectedTaskIndex, 
  selectedActions,
  onTaskSelect,
  onActionChange,
  onSubmit
}: { 
  verificationFailedTasks: DownloadTaskState[];
  taskActions: Record<string, TaskAction>;
  selectedTaskIndex: number;
  selectedActions: Record<string, TaskAction>;
  onTaskSelect: (index: number) => void;
  onActionChange: (url: string, action: TaskAction) => void;
  onSubmit: () => void;
}) => {
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" borderStyle="round" paddingX={1} gap={1}>
        <Text color="yellow">Select tasks and actions:</Text>
        {verificationFailedTasks.map((task, index) => {
          const isSelected = index === selectedTaskIndex;
          const currentAction = taskActions[task.url] || "pending";
          const selectedAction = selectedActions[task.url] || currentAction;
          const showActions = isSelected || currentAction !== selectedAction; // 只要选择值与当前值不同就显示操作选项
          
          return (
            <TaskItem
              index={index}
              key={task.url}
              task={task}
              isSelected={isSelected}
              currentAction={currentAction}
              showActions={showActions}
              selectedAction={selectedAction}
            />
          );
        })}
      </Box>
      
      <Box borderStyle="round" paddingX={1}>
        <Text color="gray">Shortcuts: ↑/↓ Select task, ←/→ Select action, Enter Submit, A All-retry</Text>
      </Box>
    </Box>
  );
};

const MainView = ({ doDownloadFunc, options }: { doDownloadFunc: DoDownloadFunc; options: DownloadOptions }) => {
  const { exit } = useApp();
  const [tasks, setTasks] = useState<Record<string, DownloadTaskState>>({});
  const [downloadAssets, setDownloadAssets] = useState<Record<string, any>>({}); // 存储DownloadAsset对象
  const [done, setDone] = useState(false);
  const [taskActions, setTaskActions] = useState<Record<string, TaskAction>>({});
  const [selectedActions, setSelectedActions] = useState<Record<string, TaskAction>>({}); // 存储用户选择的操作
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
  const [processing, setProcessing] = useState(false);

  // 初始化任务操作状态
  useEffect(() => {
    const verificationFailedTasks = Object.values(tasks).filter(t => t.status === "verification_failed");
    const newTaskActions: Record<string, TaskAction> = {};
    
    verificationFailedTasks.forEach(task => {
      if (!taskActions[task.url]) {
        newTaskActions[task.url] = "pending";
      }
    });
    
    if (Object.keys(newTaskActions).length > 0) {
      setTaskActions(prev => ({ ...prev, ...newTaskActions }));
    }
  }, [tasks]);

  useInput((input, key) => {
    if (input === "c" && (key.ctrl || key.meta)) {
      exit();
      return;
    }

    const verificationFailedTasks = Object.values(tasks).filter(t => t.status === "verification_failed");
    
    // 如果没有验证失败的任务，使用默认的输入处理
    if (verificationFailedTasks.length === 0) {
      return;
    }

    // 处理方向键输入
    if (key.upArrow) {
      setSelectedTaskIndex(prev => (prev > 0 ? prev - 1 : verificationFailedTasks.length - 1));
    } else if (key.downArrow) {
      setSelectedTaskIndex(prev => (prev < verificationFailedTasks.length - 1 ? prev + 1 : 0));
    } else if (key.leftArrow) {
      const actions: TaskAction[] = ["pending", "retry", "skip", "reject"];
      const selectedTask = verificationFailedTasks[selectedTaskIndex];
      if (selectedTask) {
        const currentAction = taskActions[selectedTask.url] || "pending";
        const selectedAction = selectedActions[selectedTask.url] || currentAction;
        const currentIndex = actions.indexOf(selectedAction);
        const newIndex = currentIndex > 0 ? currentIndex - 1 : actions.length - 1;
        const newAction = actions[newIndex];
        setSelectedActions(prev => ({
          ...prev,
          [selectedTask.url]: newAction
        }));
      }
    } else if (key.rightArrow) {
      const actions: TaskAction[] = ["pending", "retry", "skip", "reject"];
      const selectedTask = verificationFailedTasks[selectedTaskIndex];
      if (selectedTask) {
        const currentAction = taskActions[selectedTask.url] || "pending";
        const selectedAction = selectedActions[selectedTask.url] || currentAction;
        const currentIndex = actions.indexOf(selectedAction);
        const newIndex = currentIndex < actions.length - 1 ? currentIndex + 1 : 0;
        const newAction = actions[newIndex];
        setSelectedActions(prev => ({
          ...prev,
          [selectedTask.url]: newAction
        }));
      }
    } else if (input === "a" || input === "A") {
      // 全选重试
      const newTaskActions: Record<string, TaskAction> = {};
      verificationFailedTasks.forEach(task => {
        newTaskActions[task.url] = "retry";
      });
      setTaskActions(newTaskActions);
      setSelectedActions({}); // 清除临时选择
    } else if (key.return) {
      // 提交操作
      onSubmitActions();
    }
  });

  const onSubmitActions = async () => {
    // 处理用户选择的操作
    setProcessing(true);
    
    // 更新任务的当前操作为用户选择的操作
    const updatedTaskActions = { ...taskActions };
    Object.keys(selectedActions).forEach(url => {
      updatedTaskActions[url] = selectedActions[url];
    });
    setTaskActions(updatedTaskActions);
    setSelectedActions({}); // 清除临时选择
    
    // 根据用户选择的操作来处理任务
    const retryTasks = verificationFailed.filter(task => 
      updatedTaskActions[task.url] === "retry"
    );
    
    const skipTasks = verificationFailed.filter(task => 
      updatedTaskActions[task.url] === "skip"
    );
    
    const rejectTasks = verificationFailed.filter(task => 
      updatedTaskActions[task.url] === "reject"
    );
    
    // 处理需要重试的任务
    if (retryTasks.length > 0) {
      try {
        // 获取验证失败的资产
        const failedAssets = retryTasks.map(task => {
          // 从保存的DownloadAsset对象中获取完整的资产信息
          return downloadAssets[task.url] || {
            fileName: task.filename,
            downloadUrl: task.url,
            digest: task.digest || "",
            downloadDirname: "",
            downloadedFilePath: ""
          };
        }).filter(asset => asset.fileName && asset.downloadUrl); // 过滤掉无效的资产
        
        // 创建一个新的emitter来处理重试过程中的状态更新
        const retryEmitter = (state: EmitterState) => {
          if (state.status === "done") {
            return;
          }
          setTasks((prev) => ({
            ...prev,
            [state.url]: state,
          }));
        };
        
        // 调用retryFailedAssets函数重新处理失败的资产
        if (failedAssets.length > 0 && typeof doDownloadFunc === 'function' && 'retryFailedAssets' in doDownloadFunc) {
          await (doDownloadFunc as any).retryFailedAssets(failedAssets, {
            ...options,
            emitter: retryEmitter
          });
        }
      } catch (error) {
        console.error("Retry failed:", error);
      }
    }
    
    // 处理跳过的任务
    skipTasks.forEach(task => {
      setTasks(prev => ({
        ...prev,
        [task.url]: {
          ...task,
          status: "skipped"
        }
      }));
    });
    
    // 处理拒绝的任务
    rejectTasks.forEach(task => {
      setTasks(prev => ({
        ...prev,
        [task.url]: {
          ...task,
          status: "failed",
          error: new Error("User rejected the task")
        }
      }));
    });
    
    // 更新处理状态
    setProcessing(false);
    
    // 检查是否所有任务都已处理（不是pending状态）
    const hasPendingTasks = Object.values(updatedTaskActions).some(action => action === "pending");
    if (!hasPendingTasks) {
      setDone(true);
      setTimeout(() => exit(), 1000);
    }
  };

  useEffect(() => {
    const aborter = new AbortController();

    doDownloadFunc({
      ...options,
      signal: aborter.signal,
      emitter: (state: EmitterState) => {
        if (state.status === "done") {
          // 不立即设置完成状态，等待用户操作
          return;
        }
        // 保存DownloadAsset对象（如果存在）
        if ('fileName' in state && 'downloadUrl' in state) {
          setDownloadAssets(prev => ({
            ...prev,
            [state.url]: state
          }));
        }
        setTasks((prev) => ({
          ...prev,
          [state.url]: state,
        }));
      },
    }).catch((error) => {
      console.error("\n" + colors.red(`[grab] Download failed: ${error.message}`));
      // 延迟退出以确保错误信息能正确显示
      setTimeout(() => exit(error), 1000);
    });

    return () => aborter.abort("cancel");
  }, [doDownloadFunc, options, exit]);

  const taskList = Object.values(tasks);
  const succeeded = taskList.filter((t) => t.status === "succeeded");
  const failed = taskList.filter((t) => t.status === "failed");
  const skipped = taskList.filter((t) => t.status === "skipped");
  const inProgress = taskList.filter((t) => t.status !== "succeeded" && t.status !== "failed" && t.status !== "verification_failed");
  const verificationFailed = taskList.filter((t) => t.status === "verification_failed");

  // 确定是否所有任务都已完成（不包括验证失败的，除非用户已处理）
  const allDone = done || (inProgress.length === 0 && verificationFailed.length === 0);

  return (
    <Box flexDirection="column" gap={1}>
      {taskList.map((task) => {
        if (task.status === 'verification_failed') {
          return <VerificationFailedView key={task.url} task={task} />
        } else {
          return <PanelView key={task.url} task={task} />}
        }
      )}
      {verificationFailed.length > 0 && !processing && (
        <SelectionPanel
          verificationFailedTasks={verificationFailed}
          taskActions={taskActions}
          selectedTaskIndex={selectedTaskIndex}
          selectedActions={selectedActions}
          onTaskSelect={setSelectedTaskIndex}
          onActionChange={(url, action) => {
            setSelectedActions(prev => ({
              ...prev,
              [url]: action
            }));
          }}
          onSubmit={onSubmitActions}
        />
      )}
      {allDone && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green">✅ All tasks completed.</Text>
          <Text>
            - {succeeded.length} succeeded, {failed.length} failed, {skipped.length} skipped.
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
