import { beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "./cli";
import { loadConfig, type GrabConfig } from "./config";
import { createDownloader } from "./core/factory";
import { GithubReleaseProvider } from "./core/provider";
import fetchRender from "./render";

// Mock dependent modules
vi.mock("./config", () => ({
  loadConfig: vi.fn(),
}));
vi.mock("./core/provider");
vi.mock("./core/factory", () => ({
  createDownloader: vi.fn(),
}));
vi.mock("./render", () => ({
  default: vi.fn(),
}));

describe("CLI Integration", () => {
  const mockDoDownload = vi.fn().mockResolvedValue(void 0); // Ensure it returns a promise
  const mockHooks = { onAllComplete: vi.fn() };
  const mockBaseConfig: GrabConfig = {
    repo: "owner/repo",
    assets: [],
    hooks: mockHooks,
    tag: "config-tag",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockResolvedValue(mockBaseConfig);
    vi.mocked(createDownloader).mockReturnValue(mockDoDownload as any);
    vi.mocked(GithubReleaseProvider).mockImplementation(function (this: any, repo: string) {
      this.repo = repo;
      return this;
    } as any);
  });

  const runCliWithArgs = (args: string[]) => {
    const argv = ["/usr/bin/node", "/path/to/cli.js", ...args];
    return run(argv);
  };

  it("should use tag from config when no cli arg is provided", async () => {
    await runCliWithArgs([]);

    expect(createDownloader).toHaveBeenCalledWith(
      expect.any(GithubReleaseProvider),
      mockBaseConfig.assets,
      mockBaseConfig.hooks,
    );

    expect(mockDoDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: "config-tag",
      }),
    );
  });

  it("should use tag from cli args to override config", async () => {
    await runCliWithArgs(["--tag", "cli-tag"]);

    expect(mockDoDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: "cli-tag",
      }),
    );
  });

  it("should call fetchRender in interactive mode", async () => {
    await runCliWithArgs(["--interactive"]);

    expect(fetchRender).toHaveBeenCalledWith(mockDoDownload, expect.any(Object));
    // In interactive mode, the download is initiated by the render component, not awaited directly
    expect(mockDoDownload).not.toHaveBeenCalled();
  });

  it("should call doDownload directly in non-interactive mode", async () => {
    await runCliWithArgs([]);

    expect(mockDoDownload).toHaveBeenCalled();
    expect(fetchRender).not.toHaveBeenCalled();
  });

  it("should correctly pass hooks from config to the downloader", async () => {
    await runCliWithArgs([]);

    expect(createDownloader).toHaveBeenCalledWith(
      expect.any(GithubReleaseProvider),
      expect.any(Array),
      mockHooks, // Assert that hooks are passed through
    );
  });
});
