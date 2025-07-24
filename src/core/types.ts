/**
 * @fileoverview Defines the core types used throughout the downloader.
 *
 * @description
 * This file contains the central type definitions for assets, download states,
 * and plugin configurations. The core of the download process is modeled
 * by the `DownloadTaskState` state machine.
 */

// =================================================================
// Download Task State Machine
// =================================================================
/**
 * The lifecycle of a download task is represented by the following state machine.
 * Each state transition is triggered by an event in the download process.
 *
 * State Transition Diagram:
 *
 * [ pending ] --(start download)--> [ downloading ] --(progress)--> [ downloading ]
 *      |                                  |
 *      |                                  +--(download complete)--> [ verifying ]
 *      |
 * [ downloading ] --(download error)--> [ retrying ] --(retry)--> [ downloading ]
 *      |                                     |
 *      |                                     +--(max retries reached)--> [ failed ]
 *      |
 * [ verifying ] --(verify error)--> [ retrying ] --(retry)--> [ downloading ]
 *      |                                   |
 *      |                                   +--(max retries reached)--> [ failed ]
 *      |
 * [ verifying ] --(verify success)--> [ succeeded ]
 *
 * Each state is represented by the `DownloadTaskState` object, which contains
 * a `status` field and other relevant data for that state.
 */
export type DownloadStatus = "pending" | "downloading" | "verifying" | "retrying" | "failed" | "succeeded" | "verification_failed" | "clearing_cache" | "skipped";

export interface DownloadTaskState {
  status: DownloadStatus;
  filename: string;
  url: string;
  total: number;
  loaded: number;
  error?: Error;
  retryCount?: number;
  digest?: string;
}

/**
 * The emitter function reports the progress of the download by passing
 * `DownloadTaskState` objects. A final `done` state is emitted when all
 * tasks are complete.
 */
export type EmitterState = DownloadTaskState | { status: "done" };

// =================================================================
// Asset and Plugin Definitions
// =================================================================

/**
 * A user-defined abstract resource to be downloaded.
 */
export interface Asset {
  /** The name of the asset, which can be a full name or a set of keywords. */
  name: string | string[];
  /** A list of custom plugins to process the asset after download. */
  plugins?: AssetPlugin[];
  /**
   * An optional target path. If provided, it's equivalent to using the `copy` plugin.
   * For more complex logic, use the `rename` plugin directly.
   */
  targetPath?: string;
}

/**
 * A resource that has been resolved by a `ReleaseProvider` to a specific file.
 */
export interface ResolvedAsset extends Asset {
  /** The original filename of the asset. */
  fileName: string;
  /** The direct download URL for the asset. */
  downloadUrl: string;
  /** The hash digest for verifying the asset's integrity (e.g., "sha256:deadbeef..."). */
  digest: string;
}

/**
 * A resolved asset with additional download-specific path information.
 */
export interface DownloadAsset extends ResolvedAsset {
  /** The directory where the asset will be downloaded. */
  downloadDirname: string;
  /** The full file path where the asset will be saved. */
  downloadedFilePath: string;
}

/**
 * The context object available to plugins during execution.
 */
export interface PluginContext extends DownloadAsset {
  tag: string;
}

/**
 * A function that processes a downloaded asset.
 */
export type AssetPlugin = (context: PluginContext) => Promise<void>;

// =================================================================
// Downloader Configuration
// =================================================================

/**
 * Lifecycle hooks that can be injected into the download process.
 */
export interface LifecycleHooks {
  onTagFetched?: (tag: string) => Promise<void> | void;
  getAssetCache?: (asset: DownloadAsset) => Promise<{ etag?: string } | undefined> | { etag?: string } | undefined;
  setAssetCache?: (asset: DownloadAsset, cache: { etag: string }) => Promise<void> | void;
  onAssetDownloadComplete?: (asset: DownloadAsset) => Promise<void> | void;
  onAllComplete?: () => Promise<void> | void;
}

/**
 * The configuration object for a custom downloader function.
 */
export interface CustomDownloaderConfig extends DownloadAsset {
  hooks: LifecycleHooks;
  emitter?: (state: EmitterState) => void;
  signal?: AbortSignal;
}

/**
 * A custom function to handle the download logic.
 */
export type CustomDownloaderFunction = (config: CustomDownloaderConfig) => Promise<void>;

/**
 * Defines the available download modes.
 * - 'fetch': (Default) Use the built-in Node.js fetch API.
 * - 'wget' | 'curl': Use the system's `wget` or `curl` command.
 * - string: A custom command template (e.g., "aria2c -o $DOWNLOAD_FILE $DOWNLOAD_URL").
 * - string[]: A custom command array (e.g., ["wget", "-O", "$DOWNLOAD_FILE", "$DOWNLOAD_URL"]).
 * - CustomDownloaderFunction: A JS function for full control over the download logic.
 */
export type DownloadMode = "fetch" | "wget" | "curl" | string | string[] | CustomDownloaderFunction;

/**
 * The main options for configuring the download process.
 */
export interface DownloadOptions {
  emitter?: (state: EmitterState) => void;
  signal?: AbortSignal;
  tag?: string;
  concurrency?: number;
  skipDownload?: boolean;
  useProxy?: boolean;
  proxyUrl?: string | ((originUrl: string) => string);
  cacheDir?: string;
  /**
   * The download strategy to use.
   * @default 'fetch'
   */
  mode?: DownloadMode;
}
