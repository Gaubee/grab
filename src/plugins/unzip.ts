import { createReadStream } from "node:fs";
import path from "node:path";
import * as tar from "tar";
import unzipper from "unzipper";
import { AssetPlugin } from "../core/types";

export type UnzipOptions = {
  /**
   * 解压到下载目录的某个子目录
   */
  directory?: string;
};
/**
 * 创建一个 unzip 插件。
 * 自动处理 .zip 和 .tar.gz 文件，解压到临时目录中。
 */
export const unzip = (options: UnzipOptions = {}): AssetPlugin => {
  return async (context) => {
    const { downloadedFilePath, downloadDirname } = context;
    const targetDirectory = options.directory ? path.join(downloadDirname, options.directory) : downloadDirname;
    console.log(`[Plugin:unzip] Unpacking ${downloadedFilePath} to ${targetDirectory}`);

    if (downloadedFilePath.endsWith(".zip")) {
      const stream = createReadStream(downloadedFilePath).pipe(unzipper.Extract({ path: targetDirectory }));
      await new Promise((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
      });
    } else if (downloadedFilePath.endsWith(".tar.gz")) {
      await tar.x({
        file: downloadedFilePath,
        cwd: targetDirectory,
      });
    } else {
      console.warn(`[Plugin:unzip] Unsupported file type for ${downloadedFilePath}. Skipping.`);
    }
  };
};
