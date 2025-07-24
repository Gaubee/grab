import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadConfig } from "./config";
import { createDownloader } from "./core/factory";
import { GithubReleaseProvider } from "./core/provider";
import fetchRender from "./render";

export async function run(argv: string[]) {
  // 1. 加载 grab.config.ts/js/json 文件
  const config = await loadConfig();

  // 2. 解析命令行参数，并与配置文件合并
  const args = await yargs(hideBin(argv))
    .option("tag", {
      type: "string",
      alias: "t",
      description: "Specify a release tag to download",
      default: config.tag || "latest",
    })
    .option("interactive", {
      type: "boolean",
      alias: "i",
      description: "Enable interactive TUI mode",
      default: false,
    })
    .option("mode", {
      type: "string",
      alias: "m",
      description: "the download mode",
      default: "fetch",
    })
    .option("skip-download", {
      type: "boolean",
      alias: "s",
      description: "Skip actual download, useful for metadata updates",
      default: false,
    })
    .option("use-proxy", {
      type: "boolean",
      alias: "p",
      description: "Enable proxy for downloads",
    })
    .option("proxy-url", {
      type: "string",
      description: "Specify proxy URL template, e.g. https://gh.proxy/{{href}}",
    }).argv;

  // 3. 根据最终配置创建 Provider 和 Downloader
  const provider = new GithubReleaseProvider(config.repo);
  const doDownload = createDownloader(provider, config.assets, config.hooks);

  // 4. 根据模式选择执行方式
  const options = {
    tag: args.tag,
    skipDownload: args.skipDownload,
    useProxy: args.useProxy,
    proxyUrl: args.proxyUrl,
    mode: args.interactive ? ("fetch" as const) : (args.mode as any),
  };

  if (args.interactive) {
    fetchRender(doDownload, options);
  } else {
    await doDownload({
      ...options,
      emitter: (state) => {
        if (state.status === "done") {
          console.log("[grab] All tasks completed.");
          return;
        }
        switch (state.status) {
          case "pending":
            console.log(`[grab] Pending: ${state.filename}`);
            break;
          case "downloading":
            if (state.total > 0) {
              const percent = Math.round((state.loaded / state.total) * 100);
              process.stdout.write(`[grab] Downloading: ${state.filename} ${percent}%\r`);
            }
            break;
          case "verifying":
            console.log(`\n[grab] Verifying: ${state.filename}`);
            break;
          case "succeeded":
            console.log(`\n[grab] Succeeded: ${state.filename}`);
            break;
          case "failed":
            console.error(`\n[grab] Failed: ${state.filename} - ${state.error?.message}`);
            break;
        }
      },
    });
  }
}

// 只有在直接执行此文件时才运行
if (process.env.VITEST === undefined) {
  run(process.argv).catch((error) => {
    console.error("\x1b[31m%s\x1b[0m", `[grab] Error: ${error.message}`);
    process.exit(1);
  });
}
