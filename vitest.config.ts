import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 使用 node 环境进行测试
    environment: "node",
    // 在每个测试文件执行前清理 mock
    clearMocks: true,
  },
});
