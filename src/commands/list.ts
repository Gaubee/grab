/**
 * @fileoverview `grab list` command implementation
 * Lists available assets for a GitHub release
 */

import { GithubReleaseProvider, type GithubReleaseInfo } from "../core/provider";

export interface ListCommandOptions {
  repo: string;
  tag?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Format file size in human-readable format
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/**
 * Format date in human-readable format
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

  return date.toLocaleDateString();
}

/**
 * Execute the `grab list` command
 */
export async function listCommand(options: ListCommandOptions): Promise<void> {
  const { repo, tag = "latest", json = false, verbose = false } = options;

  // Validate repo format
  if (!/^[\w-]+\/[\w-]+$/.test(repo)) {
    throw new Error(
      `Invalid repository format: "${repo}"\n` +
      `Expected format: owner/repo (e.g., oven-sh/bun)`
    );
  }

  // Fetch release info
  const provider = new GithubReleaseProvider(repo);
  let releaseInfo: GithubReleaseInfo;

  try {
    // We need to expose fetchReleaseByTag publicly or use getLatestTag + resolveAssets
    // For now, let's create a new method in provider
    releaseInfo = await provider.getReleaseInfo(tag);
  } catch (error) {
    throw new Error(
      `Failed to fetch release info for "${repo}@${tag}"\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // JSON output mode
  if (json) {
    console.log(JSON.stringify(releaseInfo, null, 2));
    return;
  }

  // Human-readable output
  console.log();
  console.log(`\x1b[1mRelease:\x1b[0m ${releaseInfo.tag_name} (${formatDate(releaseInfo.published_at)})`);

  if (verbose && releaseInfo.name && releaseInfo.name !== releaseInfo.tag_name) {
    console.log(`\x1b[1mName:\x1b[0m ${releaseInfo.name}`);
  }

  if (verbose && releaseInfo.prerelease) {
    console.log(`\x1b[33m⚠ Pre-release\x1b[0m`);
  }

  console.log(`\x1b[1mAvailable assets (${releaseInfo.assets.length}):\x1b[0m`);
  console.log();

  // List all assets
  releaseInfo.assets.forEach((asset, index) => {
    const num = `${index + 1}`.padStart(3, ' ');
    const name = asset.name.padEnd(40, ' ');
    const size = formatSize(asset.size).padStart(10, ' ');

    console.log(`  ${num}. ${name} ${size}`);

    if (verbose) {
      console.log(`       Download count: ${asset.download_count}`);
      console.log(`       URL: ${asset.browser_download_url}`);
    }
  });

  console.log();

  // Suggest commands (only if not verbose to avoid clutter)
  if (!verbose && releaseInfo.assets.length > 0) {
    console.log(`\x1b[2mSuggested commands:\x1b[0m`);

    // Show first asset as example
    const firstAsset = releaseInfo.assets[0];
    console.log(`  \x1b[2mgrab ${repo} --name "${firstAsset.name}"\x1b[0m`);

    // Try to suggest platform/arch based commands
    const linuxAsset = releaseInfo.assets.find(a =>
      a.name.toLowerCase().includes('linux') &&
      (a.name.toLowerCase().includes('x64') || a.name.toLowerCase().includes('amd64'))
    );

    if (linuxAsset) {
      console.log(`  \x1b[2mgrab ${repo} --platform linux --arch x64\x1b[0m`);
    }

    console.log();
  }

  // Show release body if verbose
  if (verbose && releaseInfo.body) {
    console.log(`\x1b[1mRelease Notes:\x1b[0m`);
    console.log();
    // Truncate if too long
    const body = releaseInfo.body.length > 500
      ? releaseInfo.body.substring(0, 500) + '...'
      : releaseInfo.body;
    console.log(body);
    console.log();
  }
}
