import { Asset, ResolvedAsset } from "./types";

/**
 * ReleaseProvider 定义了与版本发布源（如 GitHub Release）交互的接口。
 * 它负责将用户提供的抽象资源请求（如平台、架构）解析为具体的、可下载的资源。
 */
export interface ReleaseProvider {
  /**
   * 获取最新的 release tag。
   */
  getLatestTag(): Promise<string>;

  /**
   * 将用户定义的资源列表解析为可供下载的具体资源。
   * @param tag - The release tag to use.
   * @param assets - 用户的抽象资源定义。
   * @returns A promise that resolves to a list of concrete, downloadable assets.
   */
  resolveAssets(tag: string, assets: Asset[]): Promise<ResolvedAsset[]>;
}

export class GithubReleaseProvider implements ReleaseProvider {
  private releaseDataCache: Map<string, any> = new Map();

  constructor(private repo: string) {}

  async getLatestTag(): Promise<string> {
    const release = await this.fetchReleaseByTag("latest");
    return release.tag_name;
  }

  async resolveAssets(tag: string, assets: Asset[]): Promise<ResolvedAsset[]> {
    const release = await this.fetchReleaseByTag(tag);
    const resolvedAssets: ResolvedAsset[] = [];

    for (const asset of assets) {
      let foundAsset: GithubReleaseAsset | undefined;
      const asset_name = asset.name;
      if (Array.isArray(asset_name)) {
        foundAsset = release.assets.find((ghAsset) => {
          return asset_name.every((term) => ghAsset.name.includes(term));
        });
      } else {
        foundAsset =
          release.assets.find((ghAsset) => ghAsset.name === asset_name) ??
          release.assets.find((ghAsset) => ghAsset.name.includes(asset_name));
      }

      if (!foundAsset) {
        console.error(release.assets.map((a) => a.name));
        throw new Error(`Could not find a matching asset for by "${asset_name}" in release "${tag}".`);
      }

      resolvedAssets.push({
        ...asset,
        fileName: foundAsset.name,
        downloadUrl: foundAsset.browser_download_url,
        digest: foundAsset.digest,
      });
    }

    return resolvedAssets;
  }

  /**
   * Get release information for a specific tag (public API for commands)
   * @param tag - The release tag (e.g., "v2.11.6" or "latest")
   */
  async getReleaseInfo(tag: string): Promise<GithubReleaseInfo> {
    return this.fetchReleaseByTag(tag);
  }

  /**
   * 从 GitHub API 获取并缓存指定 tag 的 release 信息。
   * @param tag - The release tag (e.g., "v2.11.6" or "latest").
   */
  private async fetchReleaseByTag(tag: string): Promise<GithubReleaseInfo> {
    const cacheKey = tag;
    if (this.releaseDataCache.has(cacheKey)) {
      return this.releaseDataCache.get(cacheKey);
    }

    const url =
      tag === "latest"
        ? `https://api.github.com/repos/${this.repo}/releases/latest`
        : `https://api.github.com/repos/${this.repo}/releases/tags/${tag}`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch release info for tag "${tag}" from repo "${this.repo}": ${res.statusText}`);
    }

    const data = (await res.json()) as GithubReleaseInfo;
    this.releaseDataCache.set(cacheKey, data);
    return data;
  }
}
export type GithubReleaseInfo = {
  url: string;
  assets_url: string;
  upload_url: string;
  html_url: string;
  id: number;
  author: GithubReleaseAuthor;
  node_id: string;
  tag_name: string;
  target_commitish: string;
  name: string;
  draft: boolean;
  immutable: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: GithubReleaseAsset[];
  tarball_url: string;
  zipball_url: string;
  body: string;
  reactions: GithubReleaseReactions;
  mentions_count: number;
};

export interface GithubReleaseAuthor {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  user_view_type: string;
  site_admin: boolean;
}

export interface GithubReleaseAsset {
  url: string;
  id: number;
  node_id: string;
  name: string;
  label: string;
  uploader: GithubReleaseUploader;
  content_type: string;
  state: string;
  size: number;
  digest: string;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
}

export interface GithubReleaseUploader {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  user_view_type: string;
  site_admin: boolean;
}

export interface GithubReleaseReactions {
  url: string;
  total_count: number;
  "+1": number;
  "-1": number;
  laugh: number;
  hooray: number;
  confused: number;
  heart: number;
  rocket: number;
  eyes: number;
}
