import { createWriteStream, mkdirSync, statSync } from "node:fs";
import { Writable } from "node:stream";
import { $ } from "@gaubee/nodekit";
import path from "node:path";
import type { DownloadOptions, LifecycleHooks, ResolvedAsset } from "./types";

/**
 * 下载单个指定的资源文件。
 *
 * @param asset - 已解析的、可下载的资源对象。
 * @param downloadUrl - 资源的完整下载 URL (可含代理)。
 * @param options - 下载选项。
 * @param hooks - 生命周期钩子，用于缓存管理等。
 */
export const downloadAsset = async (
  asset: ResolvedAsset,
  downloadUrl: string,
  options: DownloadOptions,
  hooks: LifecycleHooks,
) => {
  const { mode = "fetch", emitter, signal, skipDownload = false } = options;
  const { targetPath } = asset; // 注意：此处的 targetPath 是临时下载路径

  const outdir = path.dirname(targetPath);
  mkdirSync(outdir, { recursive: true });

  if (skipDownload) {
    emitter?.({ type: "start", filename: asset.fileName, total: -1 });
    return;
  }

  const cache = (await hooks.getAssetCache?.(asset)) ?? {};

  if (mode === "fetch") {
    const headers = new Headers();
    let existingLength = 0;

    try {
      const stats = statSync(targetPath);
      existingLength = stats.size;
      headers.set("Range", `bytes=${existingLength}-`);
    } catch (error) {}

    if (cache.etag) {
      headers.set("If-None-Match", cache.etag);
    }

    emitter?.({ type: "start", filename: asset.fileName, total: 0 });

    let res = await fetch(downloadUrl, { signal, headers });

    if (res.status === 304) {
      emitter?.({
        type: "start",
        filename: asset.fileName,
        total: existingLength,
      });
      emitter?.({ type: "progress", chunkSize: existingLength });
      return;
    }

    if (res.status === 416) {
      res = await fetch(downloadUrl, { signal, method: "HEAD" });
      if (res.ok && res.headers.get("etag")) {
        await hooks.setAssetCache?.(asset, { etag: res.headers.get("etag")! });
      }
      return;
    }

    if (!res.ok && res.status !== 206) {
      throw new Error(
        `Failed to download file: ${res.status} ${res.statusText} from ${downloadUrl}`,
      );
    }

    if (res.body) {
      const etag = res.headers.get("etag");
      if (etag) {
        await hooks.setAssetCache?.(asset, { etag });
      }

      let total = +(res.headers.get("content-length") || 0);
      let writeStreamOptions = {};

      if (res.status === 206) {
        total += existingLength;
        writeStreamOptions = { flags: "a" };
      } else {
        existingLength = 0;
      }

      emitter?.({ type: "start", filename: asset.fileName, total });
      let loaded = existingLength;

      await res.body
        .pipeThrough(
          new TransformStream({
            start() {
              if (loaded > 0) {
                emitter?.({ type: "progress", chunkSize: loaded });
              }
            },
            transform: (chunk, controller) => {
              controller.enqueue(chunk);
              loaded += chunk.length;
              emitter?.({ type: "progress", chunkSize: chunk.length });
            },
          }),
        )
        .pipeTo(
          Writable.toWeb(createWriteStream(targetPath, writeStreamOptions)),
        );
    }
  } else if (mode === "wget") {
    await $.spawn("wget", ["-c", "-S", downloadUrl, "-O", targetPath], {
      async stderr(io) {
        let stderr = "";
        for await (const chunk of io) {
          stderr += chunk;
        }
        const match = stderr.match(/ETag: ("[^"]*")/);
        if (match && match[1]) {
          await hooks.setAssetCache?.(asset, { etag: match[1] });
        }
      },
    });
  }
};
