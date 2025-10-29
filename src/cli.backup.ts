/**
 * @fileoverview CLI-First implementation
 *
 * New CLI design principles:
 * 1. Zero-config: `grab <repo>` should work
 * 2. Config is optional: only needed for advanced features
 * 3. CLI args override config
 * 4. Smart defaults: auto-detect platform and arch
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadConfig, configFileExists } from "./config";
import { createDownloader } from "./core/factory";
import { GithubReleaseProvider } from "./core/provider";
import fetchRender from "./render";
import {
  detectPlatform,
  detectArch,
  normalizePlatform,
  normalizeArch,
  getPlatformDescription,
  type Platform,
  type Architecture
} from "./utils/platform-detect";
import { buildAssetPattern } from "./utils/asset-matcher";
import { buildBuiltinPlugins, isArchive, guessBinaryName } from "./utils/builtin-plugins";
import type { Asset } from "./core/types";

/**
 * Parse and validate repository format
 *
 * @param repo - Repository string (owner/name)
 * @returns Validated repo string
 * @throws Error if format is invalid
 */
function validateRepo(repo: string): string {
  if (!repo) {
    throw new Error('Repository is required. Format: owner/repo (e.g., oven-sh/bun)');
  }

  if (!/^[\w-]+\/[\w-]+$/.test(repo)) {
    throw new Error(
      `Invalid repository format: "${repo}"\n` +
      `Expected format: owner/repo (e.g., oven-sh/bun)`
    );
  }

  return repo;
}

export async function run(argv: string[]) {
  // 1. Load configuration file (optional)
  const config = await loadConfig();
  const hasConfig = await configFileExists();

  // 2. Parse command line arguments
  const args = await yargs(hideBin(argv))
    // Positional argument: repo
    .command('$0 [repo]', 'Download assets from a GitHub release', (yargs) => {
      return yargs.positional('repo', {
        describe: 'GitHub repository (owner/repo)',
        type: 'string',
      });
    })
    // Platform and architecture
    .option("platform", {
      type: "string",
      alias: "p",
      description: "Platform (linux, darwin, windows)",
      choices: ['linux', 'darwin', 'windows', 'macos', 'osx', 'mac', 'win32', 'win'],
    })
    .option("arch", {
      type: "string",
      alias: "a",
      description: "Architecture (x64, arm64, x86, arm)",
      choices: ['x64', 'arm64', 'x86', 'arm', 'amd64', 'x86_64', 'aarch64', '386', 'i386', 'i686'],
    })
    // Output options
    .option("output", {
      type: "string",
      alias: "o",
      description: "Output path for the downloaded file",
    })
    .option("extract", {
      type: "boolean",
      alias: "e",
      description: "Auto-extract archives (.zip, .tar.gz)",
      default: undefined, // Let undefined mean "not specified"
    })
    .option("cleanup", {
      type: "boolean",
      alias: "c",
      description: "Delete archive after extraction",
      default: undefined,
    })
    // Matching options
    .option("name", {
      type: "string",
      alias: "n",
      description: "Exact file name or pattern to match",
    })
    // Version options
    .option("tag", {
      type: "string",
      alias: "t",
      description: "Specify a release tag to download",
      default: config.tag || "latest",
    })
    // UI options
    .option("interactive", {
      type: "boolean",
      alias: "i",
      description: "Enable interactive TUI mode",
      default: false,
    })
    .option("verbose", {
      type: "boolean",
      alias: "v",
      description: "Show verbose output",
      default: false,
    })
    .option("quiet", {
      type: "boolean",
      alias: "q",
      description: "Suppress all output except errors",
      default: false,
    })
    // Download options
    .option("mode", {
      type: "string",
      alias: "m",
      description: "Download mode (fetch, wget, curl)",
      default: "fetch",
    })
    .option("skip-download", {
      type: "boolean",
      alias: "s",
      description: "Skip actual download (useful for testing)",
      default: false,
    })
    .option("use-proxy", {
      type: "boolean",
      description: "Enable proxy for downloads",
    })
    .option("proxy-url", {
      type: "string",
      description: "Specify proxy URL template, e.g. https://gh.proxy/{{href}}",
    })
    // Help and version
    .help('h')
    .alias('h', 'help')
    .version()
    .alias('version', 'V')
    // Examples
    .example('$0 oven-sh/bun', 'Download bun for current platform')
    .example('$0 oven-sh/bun -p linux -a x64', 'Download bun for Linux x64')
    .example('$0 oven-sh/bun -o ./bin/bun --extract', 'Download and extract to ./bin/bun')
    .example('$0 oven-sh/bun --name "bun-linux-x64.zip"', 'Download specific file')
    .strict()
    .argv;

  // 3. Determine the repository
  // Priority: CLI arg > config file
  let repo = args.repo || config.repo;

  if (!repo) {
    throw new Error(
      'Repository is required.\n\n' +
      'Usage:\n' +
      '  grab <repo>          Download from repo (e.g., grab oven-sh/bun)\n' +
      '  grab                 Use repo from grab.config.ts\n\n' +
      (hasConfig
        ? 'No repo specified and grab.config.ts has no repo field.'
        : 'No grab.config.ts found. Create one with "grab init" or specify repo as argument.')
    );
  }

  // Validate repo format
  repo = validateRepo(repo);

  // 4. Determine platform and architecture
  // Priority: CLI args > config > auto-detect
  let platform: Platform | undefined;
  let arch: Architecture | undefined;

  if (args.platform) {
    platform = normalizePlatform(args.platform);
  } else if (config.platform) {
    platform = normalizePlatform(config.platform as string);
  } else if (!args.name && !config.name) {
    // Only auto-detect if not using exact name matching
    platform = detectPlatform();
    if (!args.quiet) {
      console.log(`[grab] Auto-detected platform: ${platform}`);
    }
  }

  if (args.arch) {
    arch = normalizeArch(args.arch);
  } else if (config.arch) {
    arch = normalizeArch(config.arch as string);
  } else if (!args.name && !config.name) {
    // Only auto-detect if not using exact name matching
    arch = detectArch();
    if (!args.quiet) {
      console.log(`[grab] Auto-detected architecture: ${arch}`);
    }
  }

  // 5. Determine file name pattern
  // Priority: CLI --name > config.name > platform+arch
  const name = args.name || config.name;

  // 6. Build asset configuration
  const assetPattern = buildAssetPattern({ platform, arch, name });

  // 7. Determine output options
  // Priority: CLI > config > defaults
  const output = args.output || config.output;
  const extract = args.extract !== undefined ? args.extract : (config.extract || false);
  const cleanup = args.cleanup !== undefined ? args.cleanup : (config.cleanup || false);

  // 8. Build plugins
  let plugins = buildBuiltinPlugins({
    extract,
    cleanup,
    output,
    sourcePath: output ? guessBinaryName(repo) : undefined
  });

  // If config has assets with custom plugins, warn about conflict
  if (config.assets && config.assets.length > 0) {
    console.warn(
      '[grab] Warning: Config file has "assets" field, but CLI mode is being used.\n' +
      '       CLI parameters will override config. To use config assets, run without arguments.'
    );
  }

  // 9. Create asset configuration
  const asset: Asset = {
    name: assetPattern,
    plugins,
  };

  // 10. Create provider and downloader
  const provider = new GithubReleaseProvider(repo);
  const doDownload = createDownloader(provider, [asset], config.hooks);

  // 11. Prepare download options
  const downloadOptions = {
    tag: args.tag,
    skipDownload: args.skipDownload,
    useProxy: args.useProxy ?? config.useProxy,
    proxyUrl: args.proxyUrl || config.proxyUrl,
    mode: args.interactive ? ("fetch" as const) : (args.mode as any),
    concurrency: config.concurrency,
    cacheDir: config.cacheDir,
  };

  // 12. Execute download
  if (args.interactive) {
    // Interactive TUI mode
    fetchRender(doDownload, downloadOptions);
  } else {
    // CLI mode
    await doDownload({
      ...downloadOptions,
      emitter: (state) => {
        if (args.quiet) {
          // Quiet mode: only show errors
          if (state.status === "failed") {
            console.error(`[grab] Failed: ${state.filename} - ${state.error?.message}`);
          }
          return;
        }

        if (state.status === "done") {
          console.log("[grab] ✓ All tasks completed.");
          return;
        }

        switch (state.status) {
          case "pending":
            if (args.verbose) {
              console.log(`[grab] Pending: ${state.filename}`);
            }
            break;
          case "downloading":
            if (state.total > 0) {
              const percent = Math.round((state.loaded / state.total) * 100);
              const mb = (state.total / 1024 / 1024).toFixed(1);
              process.stdout.write(`[grab] Downloading: ${state.filename} ${percent}% (${mb} MB)\r`);
            }
            break;
          case "verifying":
            console.log(`\n[grab] Verifying: ${state.filename}`);
            break;
          case "succeeded":
            console.log(`\n[grab] ✓ Succeeded: ${state.filename}`);
            break;
          case "failed":
            console.error(`\n[grab] ✗ Failed: ${state.filename} - ${state.error?.message}`);
            break;
        }
      },
    });
  }
}

// Only run if executed directly
if (process.env.VITEST === undefined) {
  run(process.argv).catch((error) => {
    console.error("\x1b[31m%s\x1b[0m", `[grab] Error: ${error.message}`);
    process.exit(1);
  });
}
