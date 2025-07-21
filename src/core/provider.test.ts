import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { GithubReleaseProvider } from "./provider";
import { Asset } from "./types";

// Mock a successful response for a release
const mockReleaseResponse = {
  tag_name: "v1.2.3",
  assets: [
    { name: "grab-v1.2.3-linux-amd64.tar.gz", browser_download_url: "url1" },
    { name: "grab-v1.2.3-windows-amd64.zip", browser_download_url: "url2" },
    { name: "grab-v1.2.3-darwin-arm64.tar.gz", browser_download_url: "url3" },
  ],
};

describe("GithubReleaseProvider", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    // Spy on global fetch before each test
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    // Restore the original fetch implementation after each test
    fetchSpy.mockRestore();
  });

  it("getLatestTag should return the tag name on successful fetch", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: "v1.0.0" }),
    } as Response);

    const provider = new GithubReleaseProvider("owner/repo");
    const tag = await provider.getLatestTag();

    expect(tag).toBe("v1.0.0");
    expect(fetchSpy).toHaveBeenCalledWith("https://api.github.com/repos/owner/repo/releases/latest");
  });

  it("getLatestTag should throw an error on failed fetch", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    } as Response);

    const provider = new GithubReleaseProvider("owner/repo");
    await expect(provider.getLatestTag()).rejects.toThrow(
      'Failed to fetch release info for tag "latest" from repo "owner/repo": Not Found',
    );
  });

  it("resolveAssets should find and resolve matching assets", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => mockReleaseResponse,
    } as Response);

    const provider = new GithubReleaseProvider("owner/repo");
    const assetsToResolve: Asset[] = [
      { platform: "linux", arch: "amd64", format: "tar.gz", targetPath: "p1" },
      { platform: "darwin", arch: "arm64", format: "tar.gz", targetPath: "p2" },
    ];

    const resolved = await provider.resolveAssets("v1.2.3", assetsToResolve);

    expect(fetchSpy).toHaveBeenCalledWith("https://api.github.com/repos/owner/repo/releases/tags/v1.2.3");
    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toEqual(
      expect.objectContaining({
        fileName: "grab-v1.2.3-linux-amd64.tar.gz",
        downloadUrl: "url1",
      }),
    );
    expect(resolved[1]).toEqual(
      expect.objectContaining({
        fileName: "grab-v1.2.3-darwin-arm64.tar.gz",
        downloadUrl: "url3",
      }),
    );
  });

  it("resolveAssets should throw an error if an asset is not found", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => mockReleaseResponse,
    } as Response);

    const provider = new GithubReleaseProvider("owner/repo");
    const assetsToResolve: Asset[] = [{ platform: "linux", arch: "nonexistent", format: "tar.gz", targetPath: "p1" }];

    await expect(provider.resolveAssets("v1.2.3", assetsToResolve)).rejects.toThrow(
      'Could not find a matching asset for platform "linux" and arch "nonexistent" in release "v1.2.3".',
    );
  });

  it("should cache release data to avoid multiple fetches for the same tag", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => mockReleaseResponse,
    } as Response);

    const provider = new GithubReleaseProvider("owner/repo");

    // First call
    await provider.resolveAssets("v1.2.3", []);
    // Second call
    await provider.resolveAssets("v1.2.3", []);

    // Fetch should only have been called once
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
