import { normalizeFilePath } from "@gaubee/nodekit";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AssetPlugin } from "../core/types";

interface RenameOptions {
  /** 在解压目录中要查找的文件名 */
  from: string;
}

/**
 * 安全地移动文件，处理跨设备（分区）移动的情况。
 * @param source 源文件路径
 * @param destination 目标文件路径
 */
async function moveFile(source: string, destination: string) {
  try {
    // 尝试快速重命名
    await fs.rename(source, destination);
  } catch (error: any) {
    // 如果是跨设备错误，则回退到复制+删除
    if (error.code === "EXDEV") {
      await fs.copyFile(source, destination);
      await fs.unlink(source);
    } else {
      // 重新抛出其他类型的错误
      throw error;
    }
  }
}

/**
 * 创建一个 rename 插件。
 * 在临时解压目录中查找文件并将其移动到最终的 targetPath。
 * @param options -重命名选项，`from` 指的是解压后二进制文件的原始名称。
 */
export const rename = (options: RenameOptions): AssetPlugin => {
  return async (context) => {
    const { tempDir, asset } = context;
    console.log(`[Plugin:rename] Searching for '${options.from}' in ${tempDir}`);

    const foundPath = await findFile(tempDir, options.from);
    if (!foundPath) {
      throw new Error(`[Plugin:rename] Could not find '${options.from}' in ${tempDir}`);
    }

    console.log(`[Plugin:rename] Moving ${foundPath} to ${asset.targetPath}`);
    // 确保目标目录存在
    await fs.mkdir(path.dirname(asset.targetPath), { recursive: true });

    // 使用新的安全移动函数
    await moveFile(foundPath, asset.targetPath);
  };
};

// 辅助函数：递归查找文件
async function findFile(dir: string, fileName: string): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = normalizeFilePath(path.join(dir, entry.name));
    if (entry.isDirectory()) {
      const result = await findFile(fullPath, fileName);
      if (result) return result;
    } else if (entry.name === fileName) {
      return fullPath;
    }
  }
  return null;
}
