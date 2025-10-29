/**
 * @fileoverview `grab cache` command implementation
 * Manage download cache
 */

import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";

export interface CacheCommandOptions {
  status?: boolean;
  list?: boolean;
  clean?: boolean;
  clear?: boolean;
  dryRun?: boolean;
  maxAge?: number; // Days
}

/**
 * Get cache directory path
 */
function getCacheDir(): string {
  // Use environment variable or default
  const cacheDir = process.env.GRAB_CACHE_DIR || path.join(
    process.env.HOME || process.env.USERPROFILE || ".",
    ".cache",
    "grab"
  );
  return cacheDir;
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Format time ago
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  const cacheDir = getCacheDir();

  if (!existsSync(cacheDir)) {
    return {
      exists: false,
      totalSize: 0,
      totalItems: 0,
      items: [],
    };
  }

  const items: Array<{
    name: string;
    size: number;
    mtime: number;
    path: string;
  }> = [];

  let totalSize = 0;

  async function scanDir(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
          items.push({
            name: path.relative(cacheDir, fullPath),
            size: stats.size,
            mtime: stats.mtimeMs,
            path: fullPath,
          });
        }
      }
    } catch (error) {
      // Ignore errors (permission, etc.)
    }
  }

  await scanDir(cacheDir);

  // Sort by modified time (newest first)
  items.sort((a, b) => b.mtime - a.mtime);

  return {
    exists: true,
    totalSize,
    totalItems: items.length,
    items,
  };
}

/**
 * Show cache status
 */
async function showStatus() {
  const cacheDir = getCacheDir();
  const stats = await getCacheStats();

  console.log();
  console.log(`\x1b[1mCache location:\x1b[0m ${cacheDir}`);

  if (!stats.exists) {
    console.log("\x1b[2mCache directory does not exist (no cached items)\x1b[0m");
    console.log();
    return;
  }

  console.log(`\x1b[1mTotal size:\x1b[0m ${formatSize(stats.totalSize)}`);
  console.log(`\x1b[1mTotal items:\x1b[0m ${stats.totalItems}`);
  console.log();

  if (stats.items.length > 0) {
    console.log("\x1b[1mRecently used:\x1b[0m");
    const recentItems = stats.items.slice(0, 5);

    recentItems.forEach((item, index) => {
      const num = `${index + 1}`.padStart(3, ' ');
      const name = item.name.padEnd(50, ' ');
      const size = formatSize(item.size).padStart(10, ' ');
      const time = formatTimeAgo(item.mtime);

      console.log(`  ${num}. ${name} ${size}   ${time}`);
    });

    console.log();

    if (stats.items.length > 5) {
      console.log(`  ... and ${stats.items.length - 5} more items`);
      console.log();
    }

    console.log(`\x1b[2mRun 'grab cache --clean' to remove items older than 30 days\x1b[0m`);
    console.log(`\x1b[2mRun 'grab cache --clear' to remove all cached items\x1b[0m`);
  }

  console.log();
}

/**
 * List all cache items
 */
async function listItems() {
  const stats = await getCacheStats();

  if (!stats.exists || stats.items.length === 0) {
    console.log("\nNo cached items found.\n");
    return;
  }

  console.log();
  console.log(`\x1b[1mCached items (${stats.totalItems}):\x1b[0m`);
  console.log();

  stats.items.forEach((item, index) => {
    const num = `${index + 1}`.padStart(4, ' ');
    const name = item.name.padEnd(50, ' ');
    const size = formatSize(item.size).padStart(10, ' ');
    const time = formatTimeAgo(item.mtime).padStart(15, ' ');

    console.log(`${num}. ${name} ${size} ${time}`);
  });

  console.log();
  console.log(`\x1b[1mTotal size:\x1b[0m ${formatSize(stats.totalSize)}`);
  console.log();
}

/**
 * Clean old cache items
 */
async function cleanCache(maxAge: number, dryRun: boolean) {
  const stats = await getCacheStats();

  if (!stats.exists || stats.items.length === 0) {
    console.log("\nNo cached items to clean.\n");
    return;
  }

  const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const itemsToDelete = stats.items.filter(item => {
    return (now - item.mtime) > maxAgeMs;
  });

  if (itemsToDelete.length === 0) {
    console.log(`\nNo items older than ${maxAge} days found.\n`);
    return;
  }

  console.log();
  console.log(`\x1b[1mItems to remove (older than ${maxAge} days):\x1b[0m`);
  console.log();

  let totalSize = 0;
  itemsToDelete.forEach((item, index) => {
    totalSize += item.size;
    console.log(`  ${index + 1}. ${item.name} (${formatSize(item.size)})`);
  });

  console.log();
  console.log(`\x1b[1mTotal:\x1b[0m ${itemsToDelete.length} items, ${formatSize(totalSize)}`);
  console.log();

  if (dryRun) {
    console.log("\x1b[2m[Dry run] No files were deleted\x1b[0m");
    console.log();
    return;
  }

  // Delete items
  let deletedCount = 0;
  for (const item of itemsToDelete) {
    try {
      await fs.unlink(item.path);
      deletedCount++;
    } catch (error) {
      console.error(`Failed to delete ${item.name}: ${error}`);
    }
  }

  console.log(`\x1b[32m✓\x1b[0m Deleted ${deletedCount} items`);
  console.log();
}

/**
 * Clear all cache
 */
async function clearCache(dryRun: boolean) {
  const stats = await getCacheStats();

  if (!stats.exists || stats.items.length === 0) {
    console.log("\nNo cached items to clear.\n");
    return;
  }

  console.log();
  console.log(`\x1b[1mThis will delete all cached items:\x1b[0m`);
  console.log(`  Items: ${stats.totalItems}`);
  console.log(`  Size: ${formatSize(stats.totalSize)}`);
  console.log();

  if (dryRun) {
    console.log("\x1b[2m[Dry run] No files were deleted\x1b[0m");
    console.log();
    return;
  }

  // Delete all items
  const cacheDir = getCacheDir();
  let deletedCount = 0;

  for (const item of stats.items) {
    try {
      await fs.unlink(item.path);
      deletedCount++;
    } catch (error) {
      console.error(`Failed to delete ${item.name}: ${error}`);
    }
  }

  // Try to remove empty directories
  try {
    await fs.rmdir(cacheDir, { recursive: true });
  } catch {
    // Ignore errors
  }

  console.log(`\x1b[32m✓\x1b[0m Cleared cache (${deletedCount} items deleted)`);
  console.log();
}

/**
 * Execute the `grab cache` command
 */
export async function cacheCommand(options: CacheCommandOptions): Promise<void> {
  const {
    status = false,
    list = false,
    clean = false,
    clear = false,
    dryRun = false,
    maxAge = 30,
  } = options;

  // Default to status if no action specified
  if (!status && !list && !clean && !clear) {
    await showStatus();
    return;
  }

  if (status) {
    await showStatus();
  }

  if (list) {
    await listItems();
  }

  if (clean) {
    await cleanCache(maxAge, dryRun);
  }

  if (clear) {
    await clearCache(dryRun);
  }
}
