import { obj_pick } from "@gaubee/util";
import { $, execa } from "execa";
import crypto from "node:crypto";
import { createReadStream, createWriteStream, mkdirSync, statSync } from "node:fs";
import { Writable } from "node:stream";
import type {
  CustomDownloaderConfig,
  DownloadAsset,
  DownloadOptions,
  DownloadTaskState,
  LifecycleHooks,
} from "./types";
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
  const { emitter, signal, mode = "fetch" } = options;
  const { downloadUrl, downloadedFilePath, downloadDirname, fileName, digest } = asset;

  mkdirSync(downloadDirname, { recursive: true });

  const emit = (state: Partial<DownloadTaskState>) => {
    emitter?.({
      status: "downloading",
      filename: fileName,
      url: downloadUrl,
      total: 0,
      loaded: 0,
      ...state,
    });
  };

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
    emit({ status: "downloading", loaded: existingLength });
    const res = await fetch(downloadUrl, { signal, headers });
    if (res.status === 304) {
      emit({ status: "succeeded", loaded: existingLength, total: existingLength });
      return;
    }
    if (res.status === 416) {
      const headRes = await fetch(downloadUrl, { signal, method: "HEAD" });
      if (headRes.ok && headRes.headers.get("etag")) {
        await hooks.setAssetCache?.(asset, { etag: headRes.headers.get("etag")! });
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
      emit({ total, loaded: existingLength });
      let loaded = existingLength;
      await res.body
        .pipeThrough(
          new TransformStream({
            transform: (chunk, controller) => {
              controller.enqueue(chunk);
              loaded += chunk.length;
              emit({ loaded, total });
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

  emit({ status: "downloading" });
  await $(executable, commandArgs, { stdio: "inherit" });
  const stats = statSync(downloadedFilePath);
  emit({ loaded: stats.size, total: stats.size });
};

export const verifyAsset = async (asset: DownloadAsset, options: DownloadOptions) => {
  const { emitter } = options;
  const { fileName, downloadUrl, digest, downloadedFilePath } = asset;

  const emit = (state: Partial<DownloadTaskState>) => {
    emitter?.({
      status: "verifying",
      filename: fileName,
      url: downloadUrl,
      total: 0,
      loaded: 0,
      digest,
      ...state,
    });
  };

  emit({});

  const [algorithm, hex] = digest.split(":");
  const fileStream = createReadStream(downloadedFilePath);
  const hashStream = crypto.createHash(algorithm);
  fileStream.pipe(hashStream);

  const localHex = await new Promise((resolve, reject) => {
    fileStream.on("error", reject);
    hashStream.on("error", reject);
    hashStream.on("finish", () => {
      resolve(hashStream.digest("hex"));
    });
  });

  if (localHex === hex) {
    emit({ status: "succeeded" });
    return true;
  } else {
    throw new Error(`Hash mismatch: expected ${hex}, got ${localHex}`);
  }
};
