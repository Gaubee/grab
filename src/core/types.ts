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
  platform: string;
  arch: string;
  format: "zip" | "tar.gz";
  targetPath: string;
  plugins?: AssetPlugin[];
}

/**
 * 由 ReleaseProvider 解析后的具体资源。
 */
export interface ResolvedAsset extends Asset {
  fileName: string;
  downloadUrl: string;
}

/**
 * 插件执行时可用的上下文信息。
 */
export interface PluginContext {
  tag: string;
  downloadedFilePath: string;
  tempDir: string;
  asset: ResolvedAsset;
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
  getAssetCache?: (asset: Asset) => Promise<{ etag?: string } | undefined> | { etag?: string } | undefined;
  setAssetCache?: (asset: Asset, cache: { etag: string }) => Promise<void> | void;
  onAssetDownloadComplete?: (asset: ResolvedAsset) => Promise<void> | void;
  onAllComplete?: () => Promise<void> | void;
}

/**
 * 自定义下载函数的配置对象。
 */
export interface CustomDownloaderConfig {
  downloadUrl: string;
  targetPath: string;
  asset: ResolvedAsset;
  hooks: LifecycleHooks;
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
  proxyUrl?: string;
  cacheDir?: string;
  /**
   * 下载策略模式。
   * @default 'fetch'
   */
  mode?: DownloadMode;
}
