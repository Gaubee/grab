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
 */
export interface Asset {
  /** 资源名称，可以是全称，也可以是一些关键词的组合，比如 name:['macos','amr64'] */
  name: string | string[];
  /** 自定义插件 */
  plugins?: AssetPlugin[];
  /**
   * 目标路径，如果配置了，等价于启用rename插件
   * 如果需要比较复杂的逻辑，请直接使用rename插件
   */
  targetPath?: string;
}

/**
 * 由 ReleaseProvider 解析后的具体资源。
 */
export interface ResolvedAsset extends Asset {
  /** 原始文件名 */
  fileName: string;
  /** 下载链接 */
  downloadUrl: string;
  /** hash 信息 */
  digest: string;
}
export interface DownloadAsset extends ResolvedAsset {
  /** 下载目录路径 */
  downloadDirname: string;
  /** 下载文件路径 */
  downloadedFilePath: string;
}

/**
 * 插件执行时可用的上下文信息。
 */
export interface PluginContext extends DownloadAsset {
  tag: string;
}

/**
 * 插件接口，定义了对下载资产进行后处理的操作。
 */
export type AssetPlugin = (context: PluginContext) => Promise<void>;

/**
 * 生命周期钩子。
 */
export interface LifecycleHooks {
  onTagFetched?: (tag: string) => Promise<void> | void;
  getAssetCache?: (asset: DownloadAsset) => Promise<{ etag?: string } | undefined> | { etag?: string } | undefined;
  setAssetCache?: (asset: DownloadAsset, cache: { etag: string }) => Promise<void> | void;
  onAssetDownloadComplete?: (asset: DownloadAsset) => Promise<void> | void;
  onAllComplete?: () => Promise<void> | void;
}

/**
 * 自定义下载函数的配置对象。
 */
export interface CustomDownloaderConfig extends DownloadAsset {
  hooks: LifecycleHooks;
  emitter?: (state: State) => void;
  signal?: AbortSignal;
}

/**
 * 自定义下载函数的签名。
 */
export type CustomDownloaderFunction = (config: CustomDownloaderConfig) => Promise<void>;

/**
 * 定义了可用的下载模式：
 * - 'fetch': (默认) 使用内置的 Node.js fetch API。
 * - 'wget' | 'curl': 使用系统中的 wget 或 curl 命令（如果存在）。
 * - string: 一个自定义命令模板，如 "aria2c -o $DOWNLOAD_FILE $DOWNLOAD_URL"。
 * - string[]: 一个自定义命令数组，如 ["wget", "-O", "$DOWNLOAD_FILE", "$DOWNLOAD_URL"]。
 * - CustomDownloaderFunction: 一个自定义的JS函数，用于完全控制下载逻辑。
 */
export type DownloadMode = "fetch" | "wget" | "curl" | string | string[] | CustomDownloaderFunction;

/**
 * 下载函数的配置选项。
 */
export interface DownloadOptions {
  emitter?: (state: State) => void;
  signal?: AbortSignal;
  tag?: string;
  skipDownload?: boolean;
  useProxy?: boolean;
  proxyUrl?: string | ((originUrl: string) => string);
  cacheDir?: string;
  /**
   * 下载策略模式。
   * @default 'fetch'
   */
  mode?: DownloadMode;
}
