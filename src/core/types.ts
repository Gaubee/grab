import { promises as fs } from "node:fs";

/**
 * 下载过程中的状态，用于 Emitter 向外报告进度。
 */
export type State =
  | {
      type: "start";
      filename: string;
      total: number;
    }
  | {
      type: "progress";
      chunkSize: number;
    }
  | {
      type: "done";
    };

/**
 * 用户定义的抽象资源。
 * 这是用户与下载器交互的主要方式，只描述“什么”，不关心“在哪里”。
 */
export interface Asset {
  /** 目标操作系统，如 'linux', 'darwin', 'windows' */
  platform: string;
  /** 目标架构，如 'amd64', 'arm64' */
  arch: string;
  /** 压缩格式，如 'zip', 'tar.gz'。Provider 会用它来更精确地匹配文件。 */
  format: "zip" | "tar.gz";
  /**
   * 下载并处理后，最终二进制文件存放的目标路径（包含文件名）。
   * @example "packages/linux-amd64/nats-server"
   */
  targetPath: string;
  /**
   * 插件列表，用于对下载后的文件进行后处理。
   */
  plugins?: AssetPlugin[];
}

/**
 * 由 ReleaseProvider 解析后的具体资源。
 * 它包含了下载所需的所有信息。
 */
export interface ResolvedAsset extends Asset {
  /**
   * 从 Release 源解析出的完整文件名。
   * @example "nats-server-v2.11.6-linux-amd64.tar.gz"
   */
  fileName: string;
  /**
   * 完整的可下载 URL。
   */
  downloadUrl: string;
}

/**
 * 插件执行时可用的上下文信息。
 */
export interface PluginContext {
  /** 当前的 release tag */
  tag: string;
  /** 下载的原始文件路径 (通常是压缩包) */
  downloadedFilePath: string;
  /** 用于解压等操作的临时目录路径 */
  tempDir: string;
  /** 已解析的、包含完整信息的资源配置 */
  asset: ResolvedAsset;
}

/**
 * 插件接口，定义了对下载资产进行后处理的操作。
 */
export type AssetPlugin = (context: PluginContext) => Promise<void>;

/**
 * 生命周期钩子，允许调用方注入自定义逻辑到下载流程的关键节点。
 */
export interface LifecycleHooks {
  onTagFetched?: (tag: string) => Promise<void> | void;
  getAssetCache?: (
    asset: Asset,
  ) => Promise<{ etag?: string } | undefined> | { etag?: string } | undefined;
  setAssetCache?: (
    asset: Asset,
    cache: { etag: string },
  ) => Promise<void> | void;
  onAssetDownloadComplete?: (asset: ResolvedAsset) => Promise<void> | void;
  onAllComplete?: () => Promise<void> | void;
}

/**
 * 下载函数的配置选项。
 */
export interface DownloadOptions {
  emitter?: (state: State) => void;
  mode?: "fetch" | "wget"; // TODO: 支持 'curl'
  signal?: AbortSignal;
  tag?: string;
  skipDownload?: boolean;
  useProxy?: boolean;
  proxyUrl?: string;
}
