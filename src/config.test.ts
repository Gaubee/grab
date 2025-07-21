import { createConfigLoader } from "unconfig";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config";

// Mock unconfig 模块
vi.mock("unconfig", () => ({
  createConfigLoader: vi.fn(),
}));

describe("loadConfig", () => {
  it("should throw an error if no config file is found", async () => {
    // 模拟 unconfig 的 load 方法返回一个空的 config
    vi.mocked(createConfigLoader).mockReturnValue({
      load: vi.fn().mockResolvedValue({
        config: null,
        sources: [],
      }),
    } as any);

    await expect(loadConfig()).rejects.toThrow("Configuration file (grab.config.ts/js/json) not found.");
  });

  it("should throw an error if repo or assets are missing", async () => {
    vi.mocked(createConfigLoader).mockReturnValue({
      load: vi.fn().mockResolvedValue({
        config: {}, // 提供一个缺少字段的空对象
        sources: ["/fake/path/grab.config.js"],
      }),
    } as any);

    await expect(loadConfig()).rejects.toThrow("Configuration must include 'repo' and 'assets' fields.");
  });
});
