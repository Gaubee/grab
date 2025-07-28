import { Text } from "ink";
import React from "react";
import type { DownloadTaskState } from "../core/types";

export const StatusDisplay: React.FC<DownloadTaskState> = ({ status, error, retryCount }) => {
  switch (status) {
    case "pending":
      return <Text color="gray">Pending...</Text>;
    case "downloading":
      return <Text color="blue">Downloading...</Text>;
    case "verifying":
      return <Text color="yellow">Verifying...</Text>;
    case "retrying":
      return (
        <Text color="yellow">
          Retrying ({retryCount})... Error: {error?.message}
        </Text>
      );
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
