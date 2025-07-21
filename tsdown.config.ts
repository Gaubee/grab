import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/cli.ts",
  outDir: "bundle",
  clean: true,
  format: "esm",
});
