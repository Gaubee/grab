/**
 * @fileoverview Platform and architecture detection utilities
 *
 * Provides functions to detect the current platform and architecture,
 * and to normalize various naming conventions.
 */

/**
 * Supported platforms
 */
export type Platform = 'linux' | 'darwin' | 'windows';

/**
 * Supported architectures
 */
export type Architecture = 'x64' | 'arm64' | 'x86' | 'arm';

/**
 * Platform aliases mapping
 * Different projects use different names for the same platform
 */
const PLATFORM_ALIASES: Record<string, Platform> = {
  // macOS aliases
  'darwin': 'darwin',
  'macos': 'darwin',
  'osx': 'darwin',
  'mac': 'darwin',

  // Linux aliases
  'linux': 'linux',

  // Windows aliases
  'win32': 'windows',
  'windows': 'windows',
  'win': 'windows',
};

/**
 * Architecture aliases mapping
 * Different projects use different names for the same architecture
 */
const ARCH_ALIASES: Record<string, Architecture> = {
  // x64 aliases
  'x64': 'x64',
  'x86_64': 'x64',
  'amd64': 'x64',
  'x86-64': 'x64',

  // arm64 aliases
  'arm64': 'arm64',
  'aarch64': 'arm64',

  // x86 aliases (32-bit)
  'x86': 'x86',
  'i386': 'x86',
  'i686': 'x86',
  '386': 'x86',

  // arm aliases (32-bit)
  'arm': 'arm',
  'armv7': 'arm',
  'armv7l': 'arm',
};

/**
 * Detect the current platform
 * @returns The normalized platform name
 * @throws Error if the platform is not supported
 */
export function detectPlatform(): Platform {
  const platform = process.platform;

  switch (platform) {
    case 'darwin':
      return 'darwin';
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    default:
      throw new Error(
        `Unsupported platform: ${platform}. ` +
        `Supported platforms: linux, darwin (macOS), windows`
      );
  }
}

/**
 * Detect the current architecture
 * @returns The normalized architecture name
 * @throws Error if the architecture is not supported
 */
export function detectArch(): Architecture {
  const arch = process.arch;

  switch (arch) {
    case 'x64':
      return 'x64';
    case 'arm64':
      return 'arm64';
    case 'ia32':
      return 'x86';
    case 'arm':
      return 'arm';
    default:
      throw new Error(
        `Unsupported architecture: ${arch}. ` +
        `Supported architectures: x64, arm64, x86, arm`
      );
  }
}

/**
 * Normalize a platform name from various aliases
 * @param platform - The platform name (may be an alias)
 * @returns The normalized platform name
 * @throws Error if the platform is not recognized
 */
export function normalizePlatform(platform: string): Platform {
  const normalized = PLATFORM_ALIASES[platform.toLowerCase()];

  if (!normalized) {
    throw new Error(
      `Unknown platform: "${platform}". ` +
      `Supported platforms: ${Object.keys(PLATFORM_ALIASES).join(', ')}`
    );
  }

  return normalized;
}

/**
 * Normalize an architecture name from various aliases
 * @param arch - The architecture name (may be an alias)
 * @returns The normalized architecture name
 * @throws Error if the architecture is not recognized
 */
export function normalizeArch(arch: string): Architecture {
  const normalized = ARCH_ALIASES[arch.toLowerCase()];

  if (!normalized) {
    throw new Error(
      `Unknown architecture: "${arch}". ` +
      `Supported architectures: ${Object.keys(ARCH_ALIASES).join(', ')}`
    );
  }

  return normalized;
}

/**
 * Get all possible aliases for a platform
 * Useful for generating file name patterns
 *
 * @param platform - The normalized platform name
 * @returns Array of all aliases for this platform
 *
 * @example
 * getPlatformAliases('darwin') // ['darwin', 'macos', 'osx', 'mac']
 */
export function getPlatformAliases(platform: Platform): string[] {
  return Object.entries(PLATFORM_ALIASES)
    .filter(([_, normalized]) => normalized === platform)
    .map(([alias]) => alias);
}

/**
 * Get all possible aliases for an architecture
 * Useful for generating file name patterns
 *
 * @param arch - The normalized architecture name
 * @returns Array of all aliases for this architecture
 *
 * @example
 * getArchAliases('x64') // ['x64', 'x86_64', 'amd64', 'x86-64']
 */
export function getArchAliases(arch: Architecture): string[] {
  return Object.entries(ARCH_ALIASES)
    .filter(([_, normalized]) => normalized === arch)
    .map(([alias]) => alias);
}

/**
 * Check if a string contains any of the platform aliases
 * Case-insensitive matching
 *
 * @param str - The string to check
 * @param platform - The platform to check for
 * @returns true if the string contains any alias of the platform
 *
 * @example
 * containsPlatform('bun-darwin-arm64.zip', 'darwin') // true
 * containsPlatform('bun-macos-arm64.zip', 'darwin') // true
 */
export function containsPlatform(str: string, platform: Platform): boolean {
  const aliases = getPlatformAliases(platform);
  const lowerStr = str.toLowerCase();

  return aliases.some(alias => lowerStr.includes(alias));
}

/**
 * Check if a string contains any of the architecture aliases
 * Case-insensitive matching
 *
 * @param str - The string to check
 * @param arch - The architecture to check for
 * @returns true if the string contains any alias of the architecture
 *
 * @example
 * containsArch('bun-linux-x86_64.zip', 'x64') // true
 * containsArch('bun-linux-amd64.zip', 'x64') // true
 */
export function containsArch(str: string, arch: Architecture): boolean {
  const aliases = getArchAliases(arch);
  const lowerStr = str.toLowerCase();

  return aliases.some(alias => lowerStr.includes(alias));
}

/**
 * Generate a human-readable description of the detected platform
 *
 * @returns A string describing the current platform and architecture
 *
 * @example
 * "linux-x64 (also matches: x86_64, amd64)"
 */
export function getPlatformDescription(): string {
  const platform = detectPlatform();
  const arch = detectArch();

  const platformAliases = getPlatformAliases(platform).filter(a => a !== platform);
  const archAliases = getArchAliases(arch).filter(a => a !== arch);

  let description = `${platform}-${arch}`;

  const aliases: string[] = [];
  if (platformAliases.length > 0) {
    aliases.push(`platform: ${platformAliases.join(', ')}`);
  }
  if (archAliases.length > 0) {
    aliases.push(`arch: ${archAliases.join(', ')}`);
  }

  if (aliases.length > 0) {
    description += ` (also matches: ${aliases.join('; ')})`;
  }

  return description;
}
