import { createConfigLoader } from "unconfig";
import type { Asset, LifecycleHooks } from "./core/types";

/**
 * 定义了 grab.config.ts 文件的结构。
 */
export interface GrabConfig {
  /**
   * GitHub 仓库，格式为 "owner/repo"。
   */
  repo: string;

  /**
   * 需要下载的资源列表。
   */
  assets: Asset[];

  /**
   * 生命周期钩子，用于在下载流程中注入自定义逻辑。
   */
  hooks?: LifecycleHooks;

  /**
   * 默认的下载 tag。
   * 可以被命令行的 --tag 参数覆盖。
   */
  tag?: string;

  /**
   * 默认是否使用代理。
   */
  useProxy?: boolean;

  /**
   * 代理 URL。
   */
  proxyUrl?: string;
}

/**
 * 加载并解析 grab.config.ts/js/json 文件。
 * @param cwd - 当前工作目录，用于开始搜索配置文件。
 * @returns 返回解析后的配置对象。
 */
export async function loadConfig(cwd = process.cwd()): Promise<GrabConfig> {
  const loader = createConfigLoader<GrabConfig>({
    sources: [
      {
        files: "grab.config",
        // load(id) { ... }
      },
    ],
    cwd,
  });

  const { config } = await loader.load();

  if (!config) {
    throw new Error("Configuration file (grab.config.ts/js/json) not found.");
  }

  if (!config.repo || !config.assets) {
    throw new Error("Configuration must include 'repo' and 'assets' fields.");
  }

  return config;
}
