import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadConfig } from "./config";
import { createDownloader } from "./core/factory";
import { GithubReleaseProvider } from "./core/provider";
import fetchRender from "./render";

async function main() {
  // 1. 加载 grab.config.ts/js/json 文件
  const config = await loadConfig();

  // 2. 解析命令行参数，并与配置文件合并
  const args = await yargs(hideBin(process.argv))
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
      default: config.useProxy ?? true,
    })
    .option("proxy-url", {
      type: "string",
      description: "Specify proxy URL",
      default: config.proxyUrl || "https://ghfast.top/",
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
    mode: args.interactive ? ("fetch" as const) : ("wget" as const),
  };

  if (args.interactive) {
    // 交互模式，启动 TUI
    fetchRender(doDownload, options);
  } else {
    // 非交互模式，直接在控制台执行
    // 增加一个简单的 emitter 来模拟进度输出
    await doDownload({
      ...options,
      emitter: (state) => {
        if (state.type === "start") {
          console.log(`[grab] Starting download: ${state.filename}`);
        } else if (state.type === "done") {
          console.log("[grab] All tasks completed.");
        }
      },
    });
  }
}

main().catch((error) => {
  console.error("\x1b[31m%s\x1b[0m", `[grab] Error: ${error.message}`);
  process.exit(1);
});
