import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock an executable entry point for the CLI
const mockMain = vi.fn();
vi.mock("./cli", async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    main: mockMain, // We can't directly test the top-level main function, so we mock it.
    // A better approach would be to export the main logic. For now, this is a placeholder.
    // In a real scenario, we would refactor cli.ts to export its core logic.
  };
});

// Mock dependent modules
vi.mock("./config", () => ({
  loadConfig: vi.fn(),
}));
vi.mock("./core/provider", () => ({
  GithubReleaseProvider: vi.fn(),
}));
vi.mock("./core/factory", () => ({
  createDownloader: vi.fn(),
}));
vi.mock("./render", () => ({
  default: vi.fn(),
}));

import type { GrabConfig } from "./config";
import { loadConfig } from "./config";
import { createDownloader } from "./core/factory";
import { GithubReleaseProvider } from "./core/provider";
import fetchRender from "./render";

// This is a helper to run the CLI logic in a controlled environment.
// In a real project, we would refactor cli.ts to export this main logic.
async function runCli(argv: string[]) {
  process.argv = ["node", "grab", ...argv];
  // Since the actual cli.ts runs on import, we re-import it to trigger the logic
  await import("./cli");
}

describe("CLI Integration", () => {
  const mockDoDownload = vi.fn();
  const mockHooks = { onAllComplete: vi.fn() };
  const mockBaseConfig: GrabConfig = {
    repo: "owner/repo",
    assets: [],
    hooks: mockHooks,
    tag: "config-tag",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mocks for a successful run
    vi.mocked(loadConfig).mockResolvedValue(mockBaseConfig);
    vi.mocked(createDownloader).mockReturnValue(mockDoDownload);
    vi.mocked(GithubReleaseProvider).mockImplementation(function (this: any, repo: string) {
      this.repo = repo;
      return this;
    } as any);
  });

  it("should use tag from config when no cli arg is provided", async () => {
    await runCli([]);

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
    await runCli(["--tag", "cli-tag"]);

    expect(mockDoDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: "cli-tag",
      }),
    );
  });

  it("should call fetchRender in interactive mode", async () => {
    await runCli(["--interactive"]);

    expect(fetchRender).toHaveBeenCalledWith(mockDoDownload, expect.any(Object));
    expect(mockDoDownload).not.toHaveBeenCalled(); // The actual call is inside render
  });

  it("should call doDownload directly in non-interactive mode", async () => {
    await runCli([]);

    expect(mockDoDownload).toHaveBeenCalled();
    expect(fetchRender).not.toHaveBeenCalled();
  });

  it("should correctly pass hooks from config to the downloader", async () => {
    await runCli([]);

    expect(createDownloader).toHaveBeenCalledWith(
      expect.any(GithubReleaseProvider),
      expect.any(Array),
      mockHooks, // Assert that hooks are passed through
    );
  });
});
