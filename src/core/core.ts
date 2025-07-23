import { obj_pick } from "@gaubee/util";
import { $, execa } from "execa";
import { createWriteStream, mkdirSync, statSync } from "node:fs";
import { Writable } from "node:stream";
import type { CustomDownloaderConfig, DownloadAsset, DownloadOptions, LifecycleHooks } from "./types";
/**
 * 智能地检查外部命令是否存在，并能特殊处理 Windows 下的 wget 别名问题。
 * @param command - 要检查的命令 (e.g., 'wget')。
 * @returns 'true' 如果命令存在, 'alias' 如果是 PowerShell 别名, 'false' 如果不存在。
 */
async function checkWin32Command(command: string): Promise<boolean | "alias"> {
  // 特殊处理 Windows 上的 wget
  if (process.platform === "win32") {
    try {
      // 1. 优先尝试标准 --version，如果成功，说明是 GNU Wget
      await execa(command, ["--version"], { stdio: "ignore" });
      return true;
    } catch {
      // 2. 如果 --version 失败，尝试用 PowerShell 检查命令身份
      try {
        const { stdout } = await execa("powershell.exe", [
          "-Command",
          `Get-Command ${command} | Select-Object -ExpandProperty CommandType`,
        ]);
        // 如果命令类型是 'Alias'，我们就知道它不是我们想要的
        if (stdout.trim().toLowerCase() === "alias") {
          return "alias";
        }
      } catch {
        // 如果 PowerShell 命令也失败了，说明命令彻底不存在
        return false;
      }
    }
  }

  return true;
}

/**
 * 下载单个指定的资源文件，根据 mode 选择不同的下载策略。
 */
export const downloadAsset = async (asset: DownloadAsset, options: DownloadOptions, hooks: LifecycleHooks) => {
  const { emitter, signal, skipDownload = false, mode = "fetch" } = options;
  const { downloadUrl, downloadedFilePath, downloadDirname } = asset; // 临时下载路径

  mkdirSync(downloadDirname, { recursive: true });

  if (skipDownload) {
    emitter?.({ type: "start", filename: asset.fileName, total: -1 });
    return;
  }

  if (typeof mode === "function") {
    const customConfig: CustomDownloaderConfig = { ...asset, ...obj_pick(options, "emitter", "signal"), hooks };
    await mode(customConfig);
    return;
  }

  if (mode === "fetch") {
    const cache = (await hooks.getAssetCache?.(asset)) ?? {};
    const headers = new Headers();
    let existingLength = 0;
    try {
      const stats = statSync(downloadedFilePath);
      existingLength = stats.size;
      headers.set("Range", `bytes=${existingLength}-`);
    } catch {}
    if (cache.etag) {
      headers.set("If-None-Match", cache.etag);
    }
    emitter?.({ type: "start", filename: asset.fileName, total: 0 });
    let res = await fetch(downloadUrl, { signal, headers });
    if (res.status === 304) {
      emitter?.({ type: "start", filename: asset.fileName, total: existingLength });
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
      throw new Error(`Failed to download file: ${res.status} ${res.statusText} from ${downloadUrl}`);
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
        .pipeTo(Writable.toWeb(createWriteStream(downloadedFilePath, writeStreamOptions)));
    }
    return;
  }

  let commandTemplate: string[];
  if (Array.isArray(mode)) {
    commandTemplate = [...mode];
  } else if (mode === "wget" || mode === "curl") {
    if (mode === "wget") {
      commandTemplate = ["wget", "-c", "-S", "-O", "$DOWNLOAD_FILE", "$DOWNLOAD_URL"];
    } else {
      commandTemplate = ["curl", "-L", "-C", "-", "-o", "$DOWNLOAD_FILE", "$DOWNLOAD_URL"];
    }
    const checkResult = await checkWin32Command(mode);
    if (checkResult === false) {
      throw new Error(`Command '${mode}' not found. Please ensure it is installed and in your system's PATH.`);
    }
    if (checkResult === "alias") {
      console.warn(`Command '${mode}' on Windows is an alias for 'Invoke-WebRequest'`);
      commandTemplate = [
        "powershell.exe",
        "-Command",
        "Start-BitsTransfer",
        "-Source",
        "$DOWNLOAD_URL",
        "-Destination",
        "$DOWNLOAD_FILE",
      ];
    }
  } else if (typeof mode === "string") {
    commandTemplate = mode.split(" ");
  } else {
    throw new Error(`Unsupported download mode: ${JSON.stringify(mode)}`);
  }

  const executable = commandTemplate[0];

  const commandArgs = commandTemplate
    .slice(1)
    .map((arg) => arg.replace(/\$DOWNLOAD_URL/g, downloadUrl).replace(/\$DOWNLOAD_FILE/g, downloadedFilePath));

  emitter?.({ type: "start", filename: asset.fileName, total: 0 });
  await $(executable, commandArgs, { stdio: "inherit" });
  const stats = statSync(downloadedFilePath);
  emitter?.({ type: "progress", chunkSize: stats.size });
};
