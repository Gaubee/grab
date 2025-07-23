import { normalizeFilePath } from "@gaubee/node";
import { promises as fs, globSync } from "node:fs";
import path from "node:path";
import { AssetPlugin } from "../core/types";

interface CopyOptions {
  /**
   * source path to copy.
   *
   * 默认是下载下来的文件名。
   * 如果使用了unzip插件，那么可以在解压目录中要查找的文件名
   */
  sourcePath?: string;
  /**
   * destination path to copy to.
   *
   * 默认是目标文件夹配置的路径
   */
  targetPath: string;
}

/**
 * 创建一个 copy 插件。
 * 在临时解压目录中查找文件并将其复制到最终的 targetPath。
 * @param options -重命名选项，`from` 指的是解压后二进制文件的原始名称。
 */
export const copy = (options: CopyOptions): AssetPlugin => {
  return async (context) => {
    const { downloadDirname } = context;
    console.log(`[Plugin:rename] Searching for '${options.sourcePath}' in ${downloadDirname}`);

    const fromPath = await findFile(downloadDirname, options.sourcePath ?? context.fileName);
    if (!fromPath) {
      console.error("ls-downloadDirname", downloadDirname, globSync(downloadDirname + "/**"));
      throw new Error(`[Plugin:rename] Could not find '${options.sourcePath}' in ${downloadDirname}`);
    }

    const toPath = options.targetPath;

    console.log(`[Plugin:rename] Moving ${fromPath} to ${toPath}`);
    // 确保目标目录存在
    await fs.mkdir(path.dirname(toPath), { recursive: true });

    await fs.cp(fromPath, toPath, { recursive: true });
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
