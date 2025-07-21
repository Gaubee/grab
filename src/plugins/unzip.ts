import { createReadStream } from "node:fs";
import path from "node:path";
import tar from "tar";
import unzipper from "unzipper";
import { AssetPlugin } from "../core/types";

/**
 * 创建一个 unzip 插件。
 * 自动处理 .zip 和 .tar.gz 文件，解压到临时目录中。
 */
export const unzip = (): AssetPlugin => {
  return async (context) => {
    const { downloadedFilePath, tempDir } = context;
    console.log(`[Plugin:unzip] Unpacking ${downloadedFilePath} to ${tempDir}`);

    if (downloadedFilePath.endsWith(".zip")) {
      const stream = createReadStream(downloadedFilePath).pipe(
        unzipper.Extract({ path: tempDir }),
      );
      await new Promise((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
      });
    } else if (downloadedFilePath.endsWith(".tar.gz")) {
      await tar.x({
        file: downloadedFilePath,
        cwd: tempDir,
      });
    } else {
      console.warn(
        `[Plugin:unzip] Unsupported file type for ${downloadedFilePath}. Skipping.`,
      );
    }
  };
};
