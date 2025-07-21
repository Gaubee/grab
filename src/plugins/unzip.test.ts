import { createReadStream } from "node:fs";
import tar from "tar";
import unzipper from "unzipper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PluginContext } from "../core/types";
import { unzip } from "./unzip";

// Mock 依赖库和 node:fs
vi.mock("tar");
vi.mock("unzipper");
vi.mock("node:fs", () => ({
  createReadStream: vi.fn(),
}));

describe("unzip Plugin", () => {
  let mockContext: PluginContext;

  beforeEach(() => {
    // 为每个测试重置 mock
    vi.clearAllMocks();

    mockContext = {
      tag: "v1.0.0",
      downloadedFilePath: "",
      tempDir: "/tmp/test-unzip",
      asset: {} as any, // 在此测试中不需要
    };

    // 默认的 mock 实现
    const mockStream = { pipe: vi.fn().mockReturnThis(), on: vi.fn((event, cb) => (event === "finish" ? cb() : null)) };
    vi.mocked(createReadStream).mockReturnValue(mockStream as any);
    vi.mocked(unzipper.Extract).mockReturnValue({} as any);
  });

  it("should call unzipper for .zip files", async () => {
    mockContext.downloadedFilePath = "/path/to/file.zip";

    await unzip()(mockContext);

    expect(createReadStream).toHaveBeenCalledWith("/path/to/file.zip");
    expect(unzipper.Extract).toHaveBeenCalledWith({ path: "/tmp/test-unzip" });
    expect(tar.x).not.toHaveBeenCalled();
  });

  it("should call tar.x for .tar.gz files", async () => {
    mockContext.downloadedFilePath = "/path/to/file.tar.gz";

    await unzip()(mockContext);

    expect(tar.x).toHaveBeenCalledWith({
      file: "/path/to/file.tar.gz",
      cwd: "/tmp/test-unzip",
    });
    expect(unzipper.Extract).not.toHaveBeenCalled();
  });

  it("should do nothing for unsupported file types and log a warning", async () => {
    mockContext.downloadedFilePath = "/path/to/file.txt";
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await unzip()(mockContext);

    expect(tar.x).not.toHaveBeenCalled();
    expect(unzipper.Extract).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[Plugin:unzip] Unsupported file type for /path/to/file.txt. Skipping.",
    );

    consoleWarnSpy.mockRestore();
  });
});
