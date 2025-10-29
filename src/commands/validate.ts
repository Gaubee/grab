/**
 * @fileoverview `grab validate` command implementation
 * Validate grab configuration file
 */

import { loadConfig } from "../config";
import type { GrabConfig } from "../config";

export interface ValidateCommandOptions {
  configPath?: string;
  verbose?: boolean;
}

/**
 * Validation error
 */
class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate repository format
 */
function validateRepo(repo: unknown): string {
  if (typeof repo !== "string") {
    throw new ValidationError("repo", "Must be a string");
  }

  if (!repo) {
    throw new ValidationError("repo", "Cannot be empty");
  }

  if (!/^[\w-]+\/[\w-]+$/.test(repo)) {
    throw new ValidationError(
      "repo",
      `Invalid format: "${repo}". Expected format: owner/repo (e.g., oven-sh/bun)`
    );
  }

  return repo;
}

/**
 * Validate platform
 */
function validatePlatform(platform: unknown): void {
  if (platform === undefined) return;

  if (typeof platform !== "string") {
    throw new ValidationError("platform", "Must be a string");
  }

  const validPlatforms = ["linux", "darwin", "windows", "macos", "osx", "mac", "win32", "win"];
  if (!validPlatforms.includes(platform)) {
    throw new ValidationError(
      "platform",
      `Invalid platform: "${platform}". Must be one of: ${validPlatforms.join(", ")}`
    );
  }
}

/**
 * Validate architecture
 */
function validateArch(arch: unknown): void {
  if (arch === undefined) return;

  if (typeof arch !== "string") {
    throw new ValidationError("arch", "Must be a string");
  }

  const validArchs = ["x64", "arm64", "x86", "arm", "amd64", "x86_64", "aarch64", "386", "i386", "i686"];
  if (!validArchs.includes(arch)) {
    throw new ValidationError(
      "arch",
      `Invalid architecture: "${arch}". Must be one of: ${validArchs.join(", ")}`
    );
  }
}

/**
 * Validate tag
 */
function validateTag(tag: unknown): void {
  if (tag === undefined) return;

  if (typeof tag !== "string") {
    throw new ValidationError("tag", "Must be a string");
  }

  if (!tag) {
    throw new ValidationError("tag", "Cannot be empty");
  }
}

/**
 * Validate assets array
 */
function validateAssets(assets: unknown): void {
  if (assets === undefined) return;

  if (!Array.isArray(assets)) {
    throw new ValidationError("assets", "Must be an array");
  }

  if (assets.length === 0) {
    throw new ValidationError("assets", "Cannot be empty");
  }

  assets.forEach((asset, index) => {
    if (typeof asset !== "object" || asset === null) {
      throw new ValidationError(
        `assets[${index}]`,
        "Each asset must be an object"
      );
    }

    const assetObj = asset as Record<string, unknown>;

    // Validate name field
    if (!assetObj.name) {
      throw new ValidationError(
        `assets[${index}].name`,
        "Missing required field 'name'"
      );
    }

    if (typeof assetObj.name !== "string" && !Array.isArray(assetObj.name)) {
      throw new ValidationError(
        `assets[${index}].name`,
        "Must be a string or array of strings"
      );
    }

    if (Array.isArray(assetObj.name)) {
      if (assetObj.name.length === 0) {
        throw new ValidationError(
          `assets[${index}].name`,
          "Array cannot be empty"
        );
      }

      assetObj.name.forEach((term, termIndex) => {
        if (typeof term !== "string") {
          throw new ValidationError(
            `assets[${index}].name[${termIndex}]`,
            "Must be a string"
          );
        }
      });
    }

    // If asset has repo, validate it
    if (assetObj.repo) {
      try {
        validateRepo(assetObj.repo);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(
            `assets[${index}].${error.field}`,
            error.message
          );
        }
        throw error;
      }
    }
  });
}

/**
 * Validate hooks
 */
function validateHooks(hooks: unknown): void {
  if (hooks === undefined) return;

  if (typeof hooks !== "object" || hooks === null) {
    throw new ValidationError("hooks", "Must be an object");
  }

  const hooksObj = hooks as Record<string, unknown>;
  const validHooks = ["onTagFetched", "onAssetDownloadComplete"];

  for (const [key, value] of Object.entries(hooksObj)) {
    if (!validHooks.includes(key)) {
      console.warn(`\x1b[33m⚠\x1b[0m Unknown hook: "${key}". Valid hooks: ${validHooks.join(", ")}`);
    }

    if (typeof value !== "function") {
      throw new ValidationError(
        `hooks.${key}`,
        "Must be a function"
      );
    }
  }
}

/**
 * Validate numeric options
 */
function validateNumericOption(name: string, value: unknown): void {
  if (value === undefined) return;

  if (typeof value !== "number") {
    throw new ValidationError(name, "Must be a number");
  }

  if (value < 0) {
    throw new ValidationError(name, "Must be a positive number");
  }

  if (!Number.isInteger(value)) {
    throw new ValidationError(name, "Must be an integer");
  }
}

/**
 * Validate boolean options
 */
function validateBooleanOption(name: string, value: unknown): void {
  if (value === undefined) return;

  if (typeof value !== "boolean") {
    throw new ValidationError(name, "Must be a boolean");
  }
}

/**
 * Validate configuration
 */
function validateConfig(config: Partial<GrabConfig>, verbose: boolean): void {
  const errors: Array<{ field: string; message: string }> = [];
  const warnings: string[] = [];

  // Check if config is empty
  if (Object.keys(config).length === 0) {
    throw new Error("Configuration is empty");
  }

  // Validate repo (optional at top level if assets is defined)
  try {
    if (config.repo) {
      validateRepo(config.repo);
    } else if (!config.assets) {
      errors.push({
        field: "repo",
        message: "Missing required field 'repo' (or define 'assets' with repo per asset)"
      });
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  // Validate platform and arch
  try { validatePlatform(config.platform); } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  try { validateArch(config.arch); } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  // Validate tag
  try { validateTag(config.tag); } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  // Validate assets
  try { validateAssets(config.assets); } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  // Validate hooks
  try { validateHooks(config.hooks); } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  // Validate numeric options
  try { validateNumericOption("concurrency", config.concurrency); } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  try { validateNumericOption("maxRetries", config.maxRetries); } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  // Validate boolean options
  try { validateBooleanOption("useProxy", config.useProxy); } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  try { validateBooleanOption("extract", config.extract); } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  try { validateBooleanOption("cleanup", config.cleanup); } catch (error) {
    if (error instanceof ValidationError) {
      errors.push({ field: error.field, message: error.message });
    }
  }

  // Warnings for deprecated or conflicting fields
  if (config.assets && config.platform) {
    warnings.push("'platform' is ignored when 'assets' is present");
  }

  if (config.assets && config.arch) {
    warnings.push("'arch' is ignored when 'assets' is present");
  }

  if (config.assets && config.name) {
    warnings.push("'name' is ignored when 'assets' is present");
  }

  // Print results
  if (errors.length > 0) {
    console.log();
    console.log("\x1b[31m✗ Validation failed\x1b[0m");
    console.log();
    errors.forEach(error => {
      console.log(`  \x1b[31m✗\x1b[0m ${error.field}: ${error.message}`);
    });
    console.log();
    throw new Error(`Found ${errors.length} validation error(s)`);
  }

  if (warnings.length > 0) {
    console.log();
    console.log("\x1b[33m⚠ Warnings:\x1b[0m");
    warnings.forEach(warning => {
      console.log(`  \x1b[33m⚠\x1b[0m ${warning}`);
    });
  }

  console.log();
  console.log("\x1b[32m✓ Configuration is valid\x1b[0m");
  console.log();

  if (verbose) {
    console.log("\x1b[1mConfiguration summary:\x1b[0m");
    console.log(JSON.stringify(config, null, 2));
    console.log();
  }
}

/**
 * Execute the `grab validate` command
 */
export async function validateCommand(options: ValidateCommandOptions): Promise<void> {
  const { verbose = false } = options;

  // Load configuration
  let config: Partial<GrabConfig>;
  try {
    config = await loadConfig();

    if (!config || Object.keys(config).length === 0) {
      throw new Error(
        "No configuration found.\n" +
        "Create grab.config.ts with 'grab init'"
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate configuration
  validateConfig(config, verbose);
}
