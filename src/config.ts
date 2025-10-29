import { createConfigLoader } from "unconfig";
import type { Asset, LifecycleHooks } from "./core/types";
import type { Platform, Architecture } from "./utils/platform-detect";
export type { Asset, LifecycleHooks };

/**
 * 定义了 grab.config.ts 文件的结构。
 */
export interface GrabConfig {
  /**
   * GitHub 仓库，格式为 "owner/repo"。
   * 在配置文件中是必填的，但 CLI 可以通过位置参数提供。
   */
  repo?: string;

  /**
   * 需要下载的资源列表。
   * 可选 - 如果不提供，将基于 platform/arch 自动推断。
   */
  assets?: Asset[];

  /**
   * 平台 (linux, darwin, windows)
   * 用于简化配置，不需要手动构建 assets
   */
  platform?: Platform | string;

  /**
   * 架构 (x64, arm64, x86, arm)
   * 用于简化配置，不需要手动构建 assets
   */
  arch?: Architecture | string;

  /**
   * 输出路径
   * 下载后的文件保存位置
   */
  output?: string;

  /**
   * 是否自动解压
   */
  extract?: boolean;

  /**
   * 解压后是否删除原始压缩包
   */
  cleanup?: boolean;

  /**
   * 文件名匹配模式
   * 用于精确匹配文件名，不使用平台/架构推断
   */
  name?: string | string[];

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

  /**
   * 并发下载数量
   */
  concurrency?: number;

  /**
   * 最大重试次数
   */
  maxRetries?: number;

  /**
   * 缓存目录
   */
  cacheDir?: string;
}

/**
 * 加载并解析 grab.config.ts/js/json 文件。
 *
 * **配置文件现在是可选的**：
 * - 如果找到配置文件，返回配置对象
 * - 如果没有配置文件，返回空对象 {}
 * - CLI 参数可以提供所有必需的值
 *
 * @param cwd - 当前工作目录，用于开始搜索配置文件。
 * @returns 返回解析后的配置对象，如果没有配置文件则返回空对象
 */
export async function loadConfig(cwd = process.cwd()): Promise<Partial<GrabConfig>> {
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

  // 配置文件是可选的
  if (!config) {
    return {};
  }

  // 验证配置文件内容（如果提供了配置文件）
  // 注意：现在 repo 和 assets 都是可选的，因为可以通过 CLI 参数提供
  // 但如果用户创建了配置文件，我们仍然建议他们提供基本信息

  return config;
}

/**
 * 检查配置文件是否存在
 *
 * @param cwd - 当前工作目录
 * @returns 如果找到配置文件返回 true
 */
export async function configFileExists(cwd = process.cwd()): Promise<boolean> {
  const loader = createConfigLoader<GrabConfig>({
    sources: [
      {
        files: "grab.config",
      },
    ],
    cwd,
  });

  const { config } = await loader.load();
  return config !== null && config !== undefined;
}
