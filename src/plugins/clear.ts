import { promises as fs } from "node:fs";
import { AssetPlugin } from "../core/types";

/**
 * 创建一个 clear 插件。
 * 删除下载的原始压缩文件。
 */
export const clear = (): AssetPlugin => {
  return async (context) => {
    const { downloadedFilePath } = context;
    console.log(`[Plugin:clear] Deleting ${downloadedFilePath}`);
    try {
      await fs.unlink(downloadedFilePath);
    } catch (error) {
      console.warn(
        `[Plugin:clear] Failed to delete ${downloadedFilePath}:`,
        error,
      );
    }
  };
};
