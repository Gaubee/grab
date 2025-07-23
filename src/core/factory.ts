import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { copy } from "../plugins";
import { downloadAsset } from "./core";
import type { ReleaseProvider } from "./provider";
import type { Asset, DownloadAsset, DownloadOptions, LifecycleHooks, PluginContext } from "./types";

async function runPlugins(asset: DownloadAsset, tag: string) {
  // 如果没有插件，但下载路径和目标路径不同，需要手动移动
  if (asset.targetPath) {
    asset.plugins?.push(copy({ targetPath: asset.targetPath }));
  }
  if (!asset.plugins || asset.plugins.length === 0) {
    return;
  }

  const tempDir = path.join(os.tmpdir(), `downloader-plugin-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  const context: PluginContext = {
    tag,
    ...asset,
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
export const createDownloader = (provider: ReleaseProvider, assets: Asset[], hooks: LifecycleHooks = {}) => {
  const doDownload = async (options: DownloadOptions = {}) => {
    const { emitter, useProxy = true, proxyUrl = "https://ghfast.top/%s", skipDownload = false } = options;

    let tag = options.tag;

    if (tag === "latest") {
      tag = await provider.getLatestTag();
      await hooks.onTagFetched?.(tag);
    }

    if (!tag) {
      throw new Error("A 'tag' is required. Please specify a release tag or use 'latest'.");
    }

    // 1. 委托 Provider 解析资源
    const resolvedAssets = await provider.resolveAssets(tag, assets);
    // 使用项目本地的、持久化的缓存目录
    const downloadCacheDir = path.resolve(process.cwd(), options.cacheDir ?? "node_modules/.cache/grab");
    mkdirSync(downloadCacheDir, { recursive: true });

    // 2. 循环下载所有已解析的资源
    for (const asset of resolvedAssets) {
      const getProxyUrl = () => {
        return typeof proxyUrl === "string"
          ? proxyUrl.replaceAll("%s", asset.downloadUrl)
          : typeof proxyUrl === "function"
            ? proxyUrl(asset.downloadUrl)
            : asset.downloadUrl;
      };
      const downloadUrl = useProxy ? getProxyUrl() : asset.downloadUrl;

      // 所有文件都先下载到统一的缓存目录
      const downloadDirname = path.join(downloadCacheDir, asset.digest.split(":").at(-1)!.slice(0, 8));

      const downloadedFilePath = path.join(downloadDirname, asset.fileName);

      const asset2: DownloadAsset = { ...asset, downloadDirname, downloadedFilePath, downloadUrl };

      await downloadAsset(asset2, options, hooks);

      // 3. 下载后执行插件系统
      if (!skipDownload) {
        await runPlugins(asset2, tag);
      }

      await hooks.onAssetDownloadComplete?.(asset2);
    }

    emitter?.({ type: "done" });
    await hooks.onAllComplete?.();
  };

  return doDownload;
};
