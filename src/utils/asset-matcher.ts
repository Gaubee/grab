/**
 * @fileoverview Asset matching utilities
 *
 * Provides intelligent matching of release assets based on platform,
 * architecture, and file name patterns.
 */

import type { Platform, Architecture } from './platform-detect';
import { getPlatformAliases, getArchAliases, containsPlatform, containsArch } from './platform-detect';

/**
 * Options for building asset name patterns
 */
export interface AssetMatchOptions {
  /**
   * Platform to match
   */
  platform?: Platform;

  /**
   * Architecture to match
   */
  arch?: Architecture;

  /**
   * Exact file name or pattern
   * If provided, platform and arch are ignored
   */
  name?: string | string[];
}

/**
 * Result of asset matching
 */
export interface MatchResult {
  /**
   * The matched asset name
   */
  name: string;

  /**
   * Confidence score (0-100)
   * Higher score means better match
   */
  score: number;

  /**
   * Reason for the match
   */
  reason: string;
}

/**
 * Build an asset name pattern for matching
 *
 * This function converts platform and architecture into a pattern
 * that can be used to match against release asset names.
 *
 * @param options - Matching options
 * @returns Array of keywords to match (all must be present)
 *
 * @example
 * buildAssetPattern({ platform: 'linux', arch: 'x64' })
 * // Returns: keywords that match linux AND x64
 */
export function buildAssetPattern(options: AssetMatchOptions): string | string[] {
  // If exact name is provided, use it
  if (options.name) {
    return options.name;
  }

  // Build pattern from platform and arch
  const keywords: string[] = [];

  if (options.platform) {
    // Add the primary platform name
    keywords.push(options.platform);
  }

  if (options.arch) {
    // Add the primary architecture name
    keywords.push(options.arch);
  }

  return keywords.length > 0 ? keywords : '';
}

/**
 * Match an asset against the given criteria
 *
 * Scoring rules:
 * - Exact name match: 100
 * - Platform + Arch match: 90
 * - Platform match only: 50
 * - Arch match only: 40
 * - No match: 0
 *
 * @param assetName - The asset name to match
 * @param options - Matching options
 * @returns Match result with score and reason
 */
export function matchAsset(assetName: string, options: AssetMatchOptions): MatchResult {
  // Exact name match
  if (options.name) {
    if (typeof options.name === 'string') {
      if (assetName === options.name) {
        return {
          name: assetName,
          score: 100,
          reason: 'Exact name match'
        };
      }
      if (assetName.includes(options.name)) {
        return {
          name: assetName,
          score: 95,
          reason: 'Name contains the specified pattern'
        };
      }
    } else {
      // Array of keywords - all must be present
      const allMatch = options.name.every(keyword =>
        assetName.toLowerCase().includes(keyword.toLowerCase())
      );
      if (allMatch) {
        return {
          name: assetName,
          score: 90,
          reason: `Matches all keywords: ${options.name.join(', ')}`
        };
      }
    }
    return {
      name: assetName,
      score: 0,
      reason: 'No match'
    };
  }

  // Platform and architecture matching
  const platformMatch = options.platform ? containsPlatform(assetName, options.platform) : false;
  const archMatch = options.arch ? containsArch(assetName, options.arch) : false;

  if (platformMatch && archMatch) {
    return {
      name: assetName,
      score: 90,
      reason: `Matches ${options.platform}-${options.arch}`
    };
  }

  if (platformMatch) {
    return {
      name: assetName,
      score: 50,
      reason: `Matches platform: ${options.platform}`
    };
  }

  if (archMatch) {
    return {
      name: assetName,
      score: 40,
      reason: `Matches architecture: ${options.arch}`
    };
  }

  return {
    name: assetName,
    score: 0,
    reason: 'No match'
  };
}

/**
 * Find the best matching asset from a list
 *
 * @param assetNames - List of available asset names
 * @param options - Matching options
 * @returns The best matching asset, or null if no good match found
 *
 * @example
 * const assets = ['bun-linux-x64.zip', 'bun-darwin-arm64.zip', 'bun-windows-x64.zip'];
 * findBestMatch(assets, { platform: 'linux', arch: 'x64' })
 * // Returns: { name: 'bun-linux-x64.zip', score: 90, reason: 'Matches linux-x64' }
 */
export function findBestMatch(
  assetNames: string[],
  options: AssetMatchOptions
): MatchResult | null {
  if (assetNames.length === 0) {
    return null;
  }

  // Score all assets
  const results = assetNames.map(name => matchAsset(name, options));

  // Sort by score (descending)
  results.sort((a, b) => b.score - a.score);

  // Return the best match (if score > 0)
  const best = results[0];
  return best.score > 0 ? best : null;
}

/**
 * Get suggested assets when no perfect match is found
 *
 * Returns assets with partial matches, sorted by score
 *
 * @param assetNames - List of available asset names
 * @param options - Matching options
 * @param limit - Maximum number of suggestions (default: 5)
 * @returns Array of suggestions
 */
export function getSuggestions(
  assetNames: string[],
  options: AssetMatchOptions,
  limit = 5
): MatchResult[] {
  const results = assetNames.map(name => matchAsset(name, options));

  // Filter out zero scores and sort
  const filtered = results.filter(r => r.score > 0);
  filtered.sort((a, b) => b.score - a.score);

  return filtered.slice(0, limit);
}

/**
 * Format a list of assets for display
 *
 * @param assetNames - List of asset names
 * @param highlight - Optional asset to highlight
 * @returns Formatted string
 */
export function formatAssetList(assetNames: string[], highlight?: string): string {
  return assetNames
    .map((name, index) => {
      const prefix = name === highlight ? '  → ' : '    ';
      return `${prefix}${index + 1}. ${name}`;
    })
    .join('\n');
}

/**
 * Generate helpful error message when no match is found
 *
 * @param assetNames - Available assets
 * @param options - Attempted match options
 * @returns Error message with suggestions
 */
export function generateNoMatchError(
  assetNames: string[],
  options: AssetMatchOptions
): string {
  const suggestions = getSuggestions(assetNames, options);

  let message = 'No matching asset found.\n\n';

  message += 'Attempted to match:\n';
  if (options.name) {
    if (typeof options.name === 'string') {
      message += `  - Name: ${options.name}\n`;
    } else {
      message += `  - Keywords: ${options.name.join(', ')}\n`;
    }
  } else {
    if (options.platform) {
      message += `  - Platform: ${options.platform}\n`;
    }
    if (options.arch) {
      message += `  - Architecture: ${options.arch}\n`;
    }
  }

  message += `\nAvailable assets (${assetNames.length}):\n`;
  message += formatAssetList(assetNames);

  if (suggestions.length > 0) {
    message += '\n\nDid you mean:\n';
    suggestions.forEach((suggestion, index) => {
      message += `  ${index + 1}. ${suggestion.name}\n`;
      message += `     (${suggestion.reason})\n`;
    });
  }

  return message;
}
