import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { copy } from "../plugins";
import { clearAssetCache, downloadAsset, HashMismatchError, verifyAsset } from "./core";
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
    const {
      //
      emitter,
      useProxy = false,
      proxyUrl,
      skipDownload = false,
      concurrency = 4,
    } = options;

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

    // 2. 并发下载所有已解析的资源
    const downloadQueue = [...resolvedAssets].map((baseAsset) => {
      const getProxyUrl = () => {
        if (typeof proxyUrl === "string") {
          if (!/\{\{.*\}\}/.test(proxyUrl)) {
            console.warn(
              `[grab] Warning: proxy-url "${proxyUrl}" does not seem to be a valid template. Expected a template like "https://my.proxy/{{href}}". Disabling proxy for this download.`,
            );
            return baseAsset.downloadUrl;
          }
          const downloadUrl = new URL(baseAsset.downloadUrl);
          return proxyUrl.replace(/\{\{(\w+)\}\}/g, (_, key) => Reflect.get(downloadUrl, key) ?? _);
        }
        if (typeof proxyUrl === "function") {
          return proxyUrl(baseAsset.downloadUrl);
        }
        return baseAsset.downloadUrl;
      };
      const downloadUrl = useProxy ? getProxyUrl() : baseAsset.downloadUrl;

      const downloadDirname = path.join(downloadCacheDir, baseAsset.digest.split(":").at(-1)!.slice(0, 8));
      const downloadedFilePath = path.join(downloadDirname, baseAsset.fileName);
      const asset: DownloadAsset = { ...baseAsset, downloadDirname, downloadedFilePath, downloadUrl };
      return asset;
    });
    for (const asset of downloadQueue) {
      emitter?.({
        status: "pending",
        filename: asset.fileName,
        url: asset.downloadUrl,
        total: 0,
        loaded: 0,
      });
    }

    const processAsset = async (asset: DownloadAsset) => {
      if (skipDownload) {
        emitter?.({
          status: "succeeded",
          filename: asset.fileName,
          url: asset.downloadUrl,
          total: -1,
          loaded: -1,
        });
      } else {
        let attempt = 0;
        const maxRetries = 3;
        while (attempt < maxRetries) {
          try {
            await downloadAsset(asset, options, hooks);
            await verifyAsset(asset, options);
            break; // Success
          } catch (error) {
            // 如果是哈希不匹配错误，发送verification_failed状态并等待用户决策
            if (error instanceof HashMismatchError) {
              emitter?.({
                status: "verification_failed",
                filename: asset.fileName,
                url: asset.downloadUrl,
                total: 0,
                loaded: 0,
                error: error,
              });
              // 等待用户决策后再继续
              return; // 不抛出错误，让TUI处理用户决策
            }

            attempt++;
            if (attempt >= maxRetries) {
              emitter?.({
                status: "failed",
                filename: asset.fileName,
                url: asset.downloadUrl,
                total: 0,
                loaded: 0,
                error: error instanceof Error ? error : new Error(String(error)),
              });
              throw error; // Final attempt failed
            }
            emitter?.({
              status: "retrying",
              filename: asset.fileName,
              url: asset.downloadUrl,
              total: 0,
              loaded: 0,
              retryCount: attempt,
              error: error instanceof Error ? error : new Error(String(error)),
            });
          }
        }
      }

      if (!skipDownload) {
        await runPlugins(asset, tag!);
      }
      await hooks.onAssetDownloadComplete?.(asset);
    };

    const workers = Array(concurrency)
      .fill(null)
      .map(async () => {
        while (downloadQueue.length > 0) {
          const asset = downloadQueue.shift();
          if (asset) {
            await processAsset(asset as DownloadAsset);
          }
        }
      });

    await Promise.all(workers);

    emitter?.({ status: "done" });
    await hooks.onAllComplete?.();
  };

  // 添加重新处理任务的函数
  const retryFailedAssets = async (failedAssets: DownloadAsset[], options: DownloadOptions = {}) => {
    const { emitter } = options;

    for (const asset of failedAssets) {
      try {
        // 发送清除缓存状态
        emitter?.({
          status: "clearing_cache",
          filename: asset.fileName,
          url: asset.downloadUrl,
          total: 0,
          loaded: 0,
        });

        // 清除资产缓存
        await clearAssetCache(asset, hooks);

        // 重新下载和验证资产
        let attempt = 0;
        const maxRetries = 3;
        while (attempt < maxRetries) {
          try {
            await downloadAsset(asset, options, hooks);
            await verifyAsset(asset, options);
            // 成功后发送成功状态
            emitter?.({
              status: "succeeded",
              filename: asset.fileName,
              url: asset.downloadUrl,
              total: 0,
              loaded: 0,
            });
            break; // Success
          } catch (error) {
            attempt++;
            if (attempt >= maxRetries) {
              emitter?.({
                status: "failed",
                filename: asset.fileName,
                url: asset.downloadUrl,
                total: 0,
                loaded: 0,
                error: error instanceof Error ? error : new Error(String(error)),
              });
              throw error; // Final attempt failed
            }
            emitter?.({
              status: "retrying",
              filename: asset.fileName,
              url: asset.downloadUrl,
              total: 0,
              loaded: 0,
              retryCount: attempt,
              error: error instanceof Error ? error : new Error(String(error)),
            });
          }
        }
      } catch (error) {
        // 如果是哈希不匹配错误，再次发送verification_failed状态
        if (error instanceof HashMismatchError) {
          emitter?.({
            status: "verification_failed",
            filename: asset.fileName,
            url: asset.downloadUrl,
            total: 0,
            loaded: 0,
            error: error,
          });
        }
      }
    }
  };

  return Object.assign(doDownload, { retryFailedAssets });
};
