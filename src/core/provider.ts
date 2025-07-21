import { Asset, ResolvedAsset } from "../types";

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
      const searchTerms = [asset.platform, asset.arch];
      if (asset.format) {
        searchTerms.push(asset.format);
      }

      const foundAsset = release.assets.find((ghAsset: any) => {
        return searchTerms.every((term) => ghAsset.name.includes(term));
      });

      if (!foundAsset) {
        throw new Error(
          `Could not find a matching asset for platform "${asset.platform}" and arch "${asset.arch}" in release "${tag}".`,
        );
      }

      resolvedAssets.push({
        ...asset,
        fileName: foundAsset.name,
        downloadUrl: foundAsset.browser_download_url,
      });
    }

    return resolvedAssets;
  }

  /**
   * 从 GitHub API 获取并缓存指定 tag 的 release 信息。
   * @param tag - The release tag (e.g., "v2.11.6" or "latest").
   */
  private async fetchReleaseByTag(tag: string): Promise<any> {
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
      throw new Error(
        `Failed to fetch release info for tag "${tag}" from repo "${this.repo}": ${res.statusText}`,
      );
    }

    const data = await res.json();
    this.releaseDataCache.set(cacheKey, data);
    return data;
  }
}
