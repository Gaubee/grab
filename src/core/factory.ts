import { downloadAsset } from "./core";
import type {
  Asset,
  DownloadOptions,
  LifecycleHooks,
  PluginContext,
  ResolvedAsset,
} from "./types";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import type { ReleaseProvider } from "./provider";

async function runPlugins(
  asset: ResolvedAsset,
  tag: string,
  downloadedFilePath: string
) {
  if (!asset.plugins || asset.plugins.length === 0) {
    // 如果没有插件，但下载路径和目标路径不同，需要手动移动
    if (downloadedFilePath !== asset.targetPath) {
      mkdirSync(path.dirname(asset.targetPath), { recursive: true });
      await fs.promises.rename(downloadedFilePath, asset.targetPath);
    }
    return;
  }

  const tempDir = path.join(os.tmpdir(), `downloader-plugin-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  const context: PluginContext = {
    tag,
    asset,
    downloadedFilePath,
    tempDir,
  };

  try {
    for (const plugin of asset.plugins) {
      await plugin(context);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * 创建一个通用的 Release 文件下载器。
 *
 * @param provider - 一个 ReleaseProvider 实例，负责与版本源交互。
 * @param assets - 需要下载的资源配置列表。
 * @param hooks - 生命周期钩子，用于注入项目特定的业务逻辑。
 * @returns 返回一个配置好的 `doDownload` 函数。
 */
export const createDownloader = (
  provider: ReleaseProvider,
  assets: Asset[],
  hooks: LifecycleHooks = {}
) => {
  const doDownload = async (options: DownloadOptions = {}) => {
    const {
      emitter,
      useProxy = true,
      proxyUrl = "https://ghfast.top/",
      skipDownload = false,
    } = options;

    let tag = options.tag;

    if (tag === "latest") {
      tag = await provider.getLatestTag();
      await hooks.onTagFetched?.(tag);
    }

    if (!tag) {
      throw new Error(
        "A 'tag' is required. Please specify a release tag or use 'latest'."
      );
    }

    // 1. 委托 Provider 解析资源
    const resolvedAssets = await provider.resolveAssets(tag, assets);
    const downloadCacheDir = path.join(os.tmpdir(), "downloader-cache");
    mkdirSync(downloadCacheDir, { recursive: true });

    // 2. 循环下载所有已解析的资源
    for (const asset of resolvedAssets) {
      const downloadUrl = useProxy
        ? proxyUrl + asset.downloadUrl
        : asset.downloadUrl;

      // 所有文件都先下载到统一的缓存目录
      const downloadedFilePath = path.join(downloadCacheDir, asset.fileName);

      await downloadAsset(
        { ...asset, targetPath: downloadedFilePath },
        downloadUrl,
        options,
        hooks
      );

      // 3. 下载后执行插件系统
      if (!skipDownload) {
        await runPlugins(asset, tag, downloadedFilePath);
      }

      await hooks.onAssetDownloadComplete?.(asset);
    }

    emitter?.({ type: "done" });
    await hooks.onAllComplete?.();
  };

  return doDownload;
};
