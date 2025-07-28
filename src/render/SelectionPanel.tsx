import { Box, Text, useApp, useInput } from "ink";
import React from "react";
import { DownloadTaskState } from "../core/types";
import { TaskAction, TaskItem } from "./TaskItem";

export const SelectionPanel: React.FC<{
  verificationFailedTasks: DownloadTaskState[];
  taskActions: Record<string, TaskAction>;
  onTaskActionsChange: (actions: Record<string, TaskAction>) => void;
  selectedTaskIndex: number;
  onSelectetdTaskIndexChange: (index: number) => void;
  selectedActions: Record<string, TaskAction>;
  onSelectedActionsChange: (actions: Record<string, TaskAction>) => void;
  onSubmit: () => void;
}> = ({
  verificationFailedTasks,
  taskActions,
  onTaskActionsChange,
  selectedTaskIndex,
  selectedActions,
  onSelectetdTaskIndexChange,
  onSelectedActionsChange,
  onSubmit,
}) => {
  const { exit } = useApp();
  useInput((input, key) => {
    if (input === "c" && (key.ctrl || key.meta)) {
      exit();
      return;
    }
    // 如果没有验证失败的任务，使用默认的输入处理
    if (verificationFailedTasks.length === 0) {
      return;
    }

    // 处理方向键输入
    if (key.upArrow) {
      onSelectetdTaskIndexChange(selectedTaskIndex > 0 ? selectedTaskIndex - 1 : verificationFailedTasks.length - 1);
    } else if (key.downArrow) {
      onSelectetdTaskIndexChange(selectedTaskIndex < verificationFailedTasks.length - 1 ? selectedTaskIndex + 1 : 0);
    } else if (key.leftArrow) {
      const actions: TaskAction[] = ["pending", "retry", "skip", "reject"];
      const selectedTask = verificationFailedTasks[selectedTaskIndex];
      if (selectedTask) {
        const currentAction = taskActions[selectedTask.url] || "pending";
        const selectedAction = selectedActions[selectedTask.url] || currentAction;
        const currentIndex = actions.indexOf(selectedAction);
        const newIndex = currentIndex > 0 ? currentIndex - 1 : actions.length - 1;
        const newAction = actions[newIndex];
        onSelectedActionsChange({
          ...selectedActions,
          [selectedTask.url]: newAction,
        });
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
        onSelectedActionsChange({
          ...selectedActions,
          [selectedTask.url]: newAction,
        });
      }
    } else if (input === "a" || input === "A") {
      // 全选重试
      const newTaskActions: Record<string, TaskAction> = {};
      verificationFailedTasks.forEach((task) => {
        newTaskActions[task.url] = "retry";
      });
      onTaskActionsChange(newTaskActions);
      onSelectedActionsChange({}); // 清除临时选择
    } else if (key.return) {
      // 提交操作
      onSubmit();
    }
  });

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
