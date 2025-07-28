import * as colors from "@std/fmt/colors";
import { Box, Text, render, useApp } from "ink";
import React, { useEffect, useState } from "react";
import type { DownloadOptions, DownloadTaskState, EmitterState } from "./core/types";
import { PanelView } from "./render/PanelView";
import { SelectionPanel } from "./render/SelectionPanel";
import { TaskAction } from "./render/TaskItem";
import { VerificationFailedView } from "./render/VerificationFailedView";

type DoDownloadFunc = (options: DownloadOptions) => Promise<void>;

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
    const verificationFailedTasks = Object.values(tasks).filter((t) => t.status === "verification_failed");
    const newTaskActions: Record<string, TaskAction> = {};

    verificationFailedTasks.forEach((task) => {
      if (!taskActions[task.url]) {
        newTaskActions[task.url] = "pending";
      }
    });

    if (Object.keys(newTaskActions).length > 0) {
      setTaskActions((prev) => ({ ...prev, ...newTaskActions }));
    }
  }, [tasks]);

  const onSubmitActions = async () => {
    // 处理用户选择的操作
    setProcessing(true);

    // 更新任务的当前操作为用户选择的操作
    const updatedTaskActions = { ...taskActions };
    Object.keys(selectedActions).forEach((url) => {
      updatedTaskActions[url] = selectedActions[url];
    });
    setTaskActions(updatedTaskActions);
    setSelectedActions({}); // 清除临时选择

    // 根据用户选择的操作来处理任务
    const retryTasks = verificationFailed.filter((task) => updatedTaskActions[task.url] === "retry");

    const skipTasks = verificationFailed.filter((task) => updatedTaskActions[task.url] === "skip");

    const rejectTasks = verificationFailed.filter((task) => updatedTaskActions[task.url] === "reject");

    // 处理需要重试的任务
    if (retryTasks.length > 0) {
      try {
        // 获取验证失败的资产
        const failedAssets = retryTasks
          .map((task) => {
            // 从保存的DownloadAsset对象中获取完整的资产信息
            return (
              downloadAssets[task.url] || {
                fileName: task.filename,
                downloadUrl: task.url,
                digest: task.digest || "",
                downloadDirname: "",
                downloadedFilePath: "",
              }
            );
          })
          .filter((asset) => asset.fileName && asset.downloadUrl); // 过滤掉无效的资产

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
        if (failedAssets.length > 0 && typeof doDownloadFunc === "function" && "retryFailedAssets" in doDownloadFunc) {
          await (doDownloadFunc as any).retryFailedAssets(failedAssets, {
            ...options,
            emitter: retryEmitter,
          });
        }
      } catch (error) {
        console.error("Retry failed:", error);
      }
    }

    // 处理跳过的任务
    skipTasks.forEach((task) => {
      setTasks((prev) => ({
        ...prev,
        [task.url]: {
          ...task,
          status: "skipped",
        },
      }));
    });

    // 处理拒绝的任务
    rejectTasks.forEach((task) => {
      setTasks((prev) => ({
        ...prev,
        [task.url]: {
          ...task,
          status: "failed",
          error: new Error("User rejected the task"),
        },
      }));
    });

    // 更新处理状态
    setProcessing(false);

    // 检查是否所有任务都已处理（不是pending状态）
    const hasPendingTasks = Object.values(updatedTaskActions).some((action) => action === "pending");
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
        if ("fileName" in state && "downloadUrl" in state) {
          setDownloadAssets((prev) => ({
            ...prev,
            [state.url]: state,
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
  const inProgress = taskList.filter(
    (t) => t.status !== "succeeded" && t.status !== "failed" && t.status !== "verification_failed",
  );
  const verificationFailed = taskList.filter((t) => t.status === "verification_failed");

  // 确定是否所有任务都已完成（不包括验证失败的，除非用户已处理）
  const allDone = done || (inProgress.length === 0 && verificationFailed.length === 0);

  return (
    <Box flexDirection="column" gap={1}>
      {taskList.map((task) => {
        if (task.status === "verification_failed") {
          return <VerificationFailedView key={task.url} task={task} />;
        } else {
          return <PanelView key={task.url} task={task} />;
        }
      })}
      {verificationFailed.length > 0 && !processing && (
        <SelectionPanel
          verificationFailedTasks={verificationFailed}
          taskActions={taskActions}
          onTaskActionsChange={setTaskActions}
          selectedTaskIndex={selectedTaskIndex}
          onSelectetdTaskIndexChange={setSelectedTaskIndex}
          selectedActions={selectedActions}
          onSelectedActionsChange={setSelectedActions}
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
