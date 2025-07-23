import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts", "src/config.ts", "src/plugins/index.ts"],
  outDir: "bundle",
  clean: true,
  format: "esm",
  dts: true,
});
