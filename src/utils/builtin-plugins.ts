/**
 * @fileoverview Built-in plugins for common post-processing tasks
 *
 * These plugins are automatically applied based on CLI flags:
 * - --extract: Auto-extract archives
 * - --cleanup: Delete original archive after extraction
 * - --output: Move/copy file to target location
 */

import { unzip } from '../plugins/unzip';
import { copy } from '../plugins/copy';
import { clear } from '../plugins/clear';
import type { AssetPlugin } from '../core/types';

/**
 * Create built-in plugins based on CLI options
 *
 * @param options - CLI options
 * @returns Array of plugins to apply
 */
export interface BuiltinPluginOptions {
  /**
   * Auto-extract archives (.zip, .tar.gz, .tgz)
   */
  extract?: boolean;

  /**
   * Delete original archive after extraction
   */
  cleanup?: boolean;

  /**
   * Target output path
   * If provided with extract, copies the extracted content
   * If provided without extract, copies the downloaded file
   */
  output?: string;

  /**
   * Source file name to copy (when using --output with --extract)
   * If not specified, tries to find the main binary
   */
  sourcePath?: string;
}

/**
 * Build an array of plugins based on options
 *
 * Execution order:
 * 1. extract (if enabled)
 * 2. copy to output (if output path is specified)
 * 3. cleanup (if enabled)
 *
 * @param options - Plugin options
 * @returns Array of plugins
 */
export function buildBuiltinPlugins(options: BuiltinPluginOptions): AssetPlugin[] {
  const plugins: AssetPlugin[] = [];

  // Step 1: Extract if requested
  if (options.extract) {
    plugins.push(unzip());
  }

  // Step 2: Copy to output location if requested
  if (options.output) {
    plugins.push(copy({
      sourcePath: options.sourcePath,
      targetPath: options.output
    }));
  }

  // Step 3: Clean up if requested
  if (options.cleanup) {
    plugins.push(clear());
  }

  return plugins;
}

/**
 * Detect if a file is an archive that can be extracted
 *
 * @param fileName - The file name to check
 * @returns true if the file can be extracted
 */
export function isArchive(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return (
    lowerName.endsWith('.zip') ||
    lowerName.endsWith('.tar.gz') ||
    lowerName.endsWith('.tgz') ||
    lowerName.endsWith('.tar')
  );
}

/**
 * Try to guess the main binary name from the repo name
 *
 * For example:
 * - "oven-sh/bun" → "bun"
 * - "denoland/deno" → "deno"
 * - "nodejs/node" → "node"
 *
 * @param repo - The GitHub repo (owner/name format)
 * @returns The guessed binary name
 */
export function guessBinaryName(repo: string): string {
  const parts = repo.split('/');
  if (parts.length >= 2) {
    return parts[1];
  }
  return parts[0];
}

/**
 * Generate suggestions for sourcePath based on file name
 *
 * @param downloadedFileName - The name of the downloaded file
 * @param repo - The GitHub repo
 * @returns Array of possible source paths to try
 */
export function suggestSourcePaths(downloadedFileName: string, repo: string): string[] {
  const suggestions: string[] = [];

  const binaryName = guessBinaryName(repo);

  // Try with .exe extension for Windows
  if (downloadedFileName.toLowerCase().includes('windows') ||
      downloadedFileName.toLowerCase().includes('win')) {
    suggestions.push(`${binaryName}.exe`);
  }

  // Try plain binary name
  suggestions.push(binaryName);

  // Try common variations
  suggestions.push(`bin/${binaryName}`);
  suggestions.push(`${binaryName}/${binaryName}`);

  return suggestions;
}
