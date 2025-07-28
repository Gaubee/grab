import { Box, Text } from "ink";
import React from "react";
import type { DownloadTaskState } from "../core/types";
// 操作选项
const TASK_ACTIONS = ["pending", "retry", "skip", "reject"] as const;
// 定义任务操作类型
export type TaskAction = (typeof TASK_ACTIONS)[number];

export const TaskItem: React.FC<{
  index: number;
  task: DownloadTaskState;
  isSelected: boolean;
  currentAction: TaskAction;
  showActions: boolean;
  selectedAction: TaskAction;
}> = ({ index, task, isSelected, currentAction, showActions, selectedAction }) => {
  // 操作选项
  const actionLabels = {
    pending: "Pending",
    retry: "Retry",
    skip: "Skip",
    reject: "Reject",
  };
  const actionColors = {
    pending: "yellow",
    retry: "blue",
    skip: "gray",
    reject: "red",
  };

  return (
    <Box flexDirection="column">
      <Box key={task.url} flexDirection="row" gap={1}>
        <Text color={isSelected ? "white" : "cyan"}>{isSelected ? "›" : " "}</Text>
        <Text color="gray">{index + 1}.</Text>
        <Text color={isSelected ? "white" : "cyan"} bold={isSelected}>
          {task.filename}
        </Text>
        <Box flexGrow={1} />
        <Text color={actionColors[currentAction]}>{actionLabels[currentAction]}</Text>
      </Box>
      {showActions && (
        <Box flexDirection="row" gap={0} paddingLeft={4}>
          <Text color="gray">Actions:</Text>
          {TASK_ACTIONS.map((act) => {
            const isActionSelected = act === selectedAction;
            return (
              <Text key={act} color={actionColors[act]}>
                {isActionSelected ? `[${actionLabels[act]}]` : ` ${actionLabels[act]} `}
              </Text>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
