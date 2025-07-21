import { createResolverByRootFile } from "@gaubee/nodekit";
import JSON5 from "json5";
import { readFileSync } from "node:fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
/// @TODO 这是旧版的，请改成新版的
import { doDownload, DownloadOptions } from "./download-binary";
import fetchRender from "./render";
const cwdResolver = createResolverByRootFile(process.cwd(), "package.json");

const rootPkg = JSON5.parse(readFileSync(cwdResolver("./package.json"), "utf-8"));

const args = await yargs(hideBin(process.argv))
  .option("tag", {
    type: "string",
    alias: "t",
    default: rootPkg.natsServerReleaseTag,
  })
  .option("interactive", {
    type: "boolean",
    alias: "i",
    default: false,
  })
  .option("skip-download", {
    type: "boolean",
    alias: "s",
    default: false,
  })
  .option("use-proxy", {
    type: "boolean",
    alias: "p",
    default: false,
  })
  .option("proxy-url", {
    type: "string",
    default: "https://ghfast.top/",
  }).argv;

const safeArgs = args satisfies DownloadOptions;

if (args.interactive) {
  fetchRender({ ...safeArgs, mode: "fetch" });
} else {
  doDownload({ ...safeArgs, mode: "wget" });
}
