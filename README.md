# Grab

A declarative, CLI-first tool for downloading and processing assets from GitHub Releases.

English | [简体中文](README-zh.md)

## Quick Start

### Zero-Config Usage

Download assets for your current platform with a single command:

```bash
# Auto-detects platform and architecture
npx @gaubee/grab oven-sh/bun

# Download and extract to specific location
npx @gaubee/grab oven-sh/bun --output ./bin/bun --extract

# Download for specific platform
npx @gaubee/grab oven-sh/bun --platform linux --arch x64 -o ./bin/bun --extract
```

### With Configuration File

Create `grab.config.ts` for repeated downloads or advanced features:

```typescript
// grab.config.ts
export default {
  repo: "oven-sh/bun",
  platform: "linux",
  arch: "x64",
  output: "./bin/bun",
  extract: true,
  cleanup: true
}
```

Then simply run:

```bash
npx @gaubee/grab
```

## Features

✅ **Zero-config** - Works out of the box with smart defaults
✅ **CLI-first** - Full functionality without configuration files
✅ **Smart matching** - Auto-detects platform and architecture
✅ **Built-in extraction** - Supports .zip, .tar.gz, .tgz
✅ **Multi-mode** - Download with fetch, wget, or curl
✅ **Proxy support** - Built-in support for GitHub mirrors
✅ **Resumable downloads** - Automatic resume with Range requests
✅ **Hash verification** - Integrity checks with GitHub digests
✅ **Interactive TUI** - Optional terminal UI with progress tracking
✅ **Rich subcommands** - list, init, cache, validate and more

## Installation

```bash
npm install -g @gaubee/grab
```

Or use directly with npx:

```bash
npx @gaubee/grab <repo>
```

## Usage

### Subcommands

#### `grab list` - List Available Assets

List all available assets for a GitHub Release:

```bash
# List latest version assets
grab list oven-sh/bun

# List specific version
grab list oven-sh/bun --tag v1.0.30

# JSON output
grab list oven-sh/bun --json

# Verbose output (download counts, URLs, release notes)
grab list oven-sh/bun --verbose
```

**Options:**
- `-t, --tag` - Specify release tag (default: latest)
- `--json` - Output in JSON format
- `-v, --verbose` - Show detailed information

#### `grab init` - Initialize Configuration

Create a `grab.config.ts` configuration file interactively:

```bash
# Interactive creation
grab init

# Use specific template
grab init --template simple    # Single asset (recommended)
grab init --template multi     # Multiple assets
grab init --template advanced  # With hooks and plugins

# Force overwrite existing config
grab init --force
```

**Options:**
- `--template` - Template type (simple/multi/advanced)
- `-f, --force` - Force overwrite existing config
- `-i, --interactive` - Interactive mode (default)

#### `grab cache` - Cache Management

Manage download cache:

```bash
# Show cache status
grab cache
grab cache --status

# List all cached items
grab cache --list

# Clean old cache (older than 30 days)
grab cache --clean

# Custom max age
grab cache --clean --max-age 7

# Clear all cache
grab cache --clear

# Dry run (preview without executing)
grab cache --clean --dry-run
```

**Options:**
- `--status` - Show cache status (default)
- `-l, --list` - List all cached items
- `--clean` - Clean old cache
- `--clear` - Clear all cache
- `--dry-run` - Preview actions
- `--max-age` - Max age in days for cleanup (default: 30)

#### `grab validate` - Validate Configuration

Validate `grab.config.ts` configuration file:

```bash
# Validate default config
grab validate

# Validate specific file
grab validate grab.config.ts

# Show detailed info
grab validate --verbose
```

**Features:**
- ✅ Validate configuration syntax and structure
- ✅ Check required fields
- ✅ Validate repo format
- ✅ Validate platform and architecture values
- ✅ Detect configuration conflicts with warnings
- ✅ Detailed error location hints

### Basic Examples

```bash
# Download bun for current platform
grab oven-sh/bun

# Download deno for Linux x64 to specific location
grab denoland/deno --platform linux --arch x64 -o ./bin/deno

# Download and auto-extract
grab oven-sh/bun --extract

# Download, extract, and cleanup archive
grab oven-sh/bun --extract --cleanup -o ./bin/bun

# Download specific version
grab oven-sh/bun --tag v1.0.30

# Match by exact file name
grab oven-sh/bun --name "bun-linux-x64-baseline.zip"
```

### Command Line Options

```
grab [repo] [options]

Positional:
  repo              GitHub repository (owner/repo)                    [string]

Platform & Architecture:
  -p, --platform    Platform (linux, darwin, windows)               [string]
  -a, --arch        Architecture (x64, arm64, x86, arm)             [string]

Output Options:
  -o, --output      Output path for downloaded file                 [string]
  -e, --extract     Auto-extract archives                           [boolean]
  -c, --cleanup     Delete archive after extraction                 [boolean]

Matching Options:
  -n, --name        Exact file name or pattern to match             [string]

Version Options:
  -t, --tag         Release tag to download           [default: "latest"]

UI Options:
  -i, --interactive Enable interactive TUI mode                      [boolean]
  -v, --verbose     Show verbose output                             [boolean]
  -q, --quiet       Suppress all output except errors               [boolean]

Download Options:
  -m, --mode        Download mode (fetch, wget, curl) [default: "fetch"]
  -s, --skip-download Skip actual download (testing)                [boolean]
  --use-proxy       Enable proxy for downloads                      [boolean]
  --proxy-url       Proxy URL template                              [string]

Help & Version:
  -h, --help        Show help                                       [boolean]
  -V, --version     Show version number                             [boolean]
```

## Configuration File

### Simple Mode (Recommended)

For single-asset downloads, use simplified configuration:

```typescript
// grab.config.ts
export default {
  repo: "oven-sh/bun",
  platform: "linux",
  arch: "x64",
  output: "./bin/bun",
  extract: true,
  cleanup: true,
  tag: "latest"
}
```

### Advanced Mode

For multiple assets or custom plugins:

```typescript
// grab.config.ts
import { unzip, copy, clear } from '@gaubee/grab/plugins';

export default {
  // Download multiple assets
  assets: [
    {
      repo: "oven-sh/bun",
      name: ["linux", "x64"],
      plugins: [
        unzip(),
        copy({ sourcePath: "bun", targetPath: "./bin/bun" }),
        clear()
      ]
    },
    {
      repo: "denoland/deno",
      name: ["linux", "x86_64"],
      plugins: [
        unzip(),
        copy({ sourcePath: "deno", targetPath: "./bin/deno" }),
        clear()
      ]
    }
  ],

  // Lifecycle hooks
  hooks: {
    onTagFetched: async (tag) => {
      console.log(`Downloading version: ${tag}`);
    },
    onAssetDownloadComplete: async (asset) => {
      console.log(`Downloaded: ${asset.fileName}`);
    }
  },

  // Global options
  concurrency: 4,
  maxRetries: 3,
  useProxy: true,
  proxyUrl: "https://ghfast.top/{{href}}"
}
```

## Platform Detection

Grab automatically detects your platform and architecture. It understands various naming conventions:

**Platform aliases:**
- `linux`
- `darwin`, `macos`, `osx`, `mac` → darwin
- `windows`, `win32`, `win` → windows

**Architecture aliases:**
- `x64`, `x86_64`, `amd64`, `x86-64` → x64
- `arm64`, `aarch64` → arm64
- `x86`, `i386`, `i686`, `386` → x86
- `arm`, `armv7`, `armv7l` → arm

## Smart Asset Matching

Grab intelligently matches assets based on your criteria:

```bash
# All of these work for Linux x64:
# - bun-linux-x64.zip
# - bun-x86_64-linux.zip
# - bun-amd64-linux.zip
grab oven-sh/bun --platform linux --arch x64
```

If no match is found, Grab shows suggestions:

```
No matching asset found.

Attempted to match:
  - Platform: linux
  - Architecture: x64

Available assets (12):
    1. bun-darwin-aarch64.zip
    2. bun-darwin-x64.zip
    3. bun-linux-aarch64.zip
    4. bun-linux-x64.zip          ← Did you mean this?
    5. bun-linux-x64-baseline.zip
    ...
```

## Interactive Mode

Launch interactive TUI for guided downloads:

```bash
grab oven-sh/bun --interactive
```

Features:
- Real-time progress tracking
- Multiple concurrent downloads
- Retry on failure
- Hash verification with user confirmation

## Proxy Support

Use GitHub mirrors for faster downloads in some regions:

```bash
# Use default proxy
grab oven-sh/bun --use-proxy

# Custom proxy URL
grab oven-sh/bun --proxy-url "https://ghproxy.com/{{href}}"

# In config file
export default {
  repo: "oven-sh/bun",
  useProxy: true,
  proxyUrl: "https://ghfast.top/{{href}}"
}
```

## Download Modes

Choose different download methods:

```bash
# Default: Node.js fetch (built-in)
grab oven-sh/bun

# Use wget
grab oven-sh/bun --mode wget

# Use curl
grab oven-sh/bun --mode curl

# Custom command
grab oven-sh/bun --mode "aria2c -x 16 -o $DOWNLOAD_FILE $DOWNLOAD_URL"
```

## Plugins

Create custom post-processing plugins:

```typescript
import type { AssetPlugin } from '@gaubee/grab';

const customPlugin: AssetPlugin = async (context) => {
  const { downloadedFilePath, fileName, tag } = context;

  // Your custom logic here
  console.log(`Processing ${fileName} from ${tag}`);
};

export default {
  assets: [{
    repo: "oven-sh/bun",
    name: ["linux", "x64"],
    plugins: [customPlugin]
  }]
}
```

## Troubleshooting

### Hash Verification Failed

```bash
# Clear cache and retry
grab cache --clear
grab oven-sh/bun

# Or disable proxy if enabled
grab oven-sh/bun --use-proxy false
```

### Platform Not Detected

```bash
# Manually specify platform and architecture
grab oven-sh/bun --platform linux --arch x64
```

### No Matching Asset

```bash
# List all available assets
grab list oven-sh/bun

# Use exact file name
grab oven-sh/bun --name "bun-linux-x64.zip"
```

### Check Cache Status

```bash
# View cache status
grab cache --status

# List all cached items
grab cache --list
```

## Examples

### Download bun

```bash
# Simplest form
grab oven-sh/bun

# With extraction and cleanup
grab oven-sh/bun --extract --cleanup -o ./bin/bun
```

### Download deno

```bash
grab denoland/deno -p linux -a x64 --extract -o ./bin/deno
```

### Download Node.js

```bash
grab nodejs/node -p linux -a x64 --extract --cleanup -o ./bin/node
```

### Multiple Tools

Create `grab.config.ts`:

```typescript
export default {
  assets: [
    { repo: "oven-sh/bun", name: ["linux", "x64"], output: "./bin/bun" },
    { repo: "denoland/deno", name: ["linux", "x86_64"], output: "./bin/deno" }
  ],
  extract: true,
  cleanup: true
}
```

## API Usage

Use as a library in your Node.js projects:

```typescript
import { createDownloader } from '@gaubee/grab';
import { GithubReleaseProvider } from '@gaubee/grab';
import { unzip, copy } from '@gaubee/grab/plugins';

const provider = new GithubReleaseProvider("oven-sh/bun");
const downloader = createDownloader(provider, [
  {
    name: ["linux", "x64"],
    plugins: [unzip(), copy({ targetPath: "./bin/bun" })]
  }
], {});

await downloader({ tag: "latest" });
```

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

### Development

```bash
# Clone the repo
git clone https://github.com/gaubee/grab-sdk.git
cd grab-sdk

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Test CLI locally
tsx src/cli.ts oven-sh/bun --platform linux --arch x64
```

## License

MIT © [Gaubee](https://github.com/gaubee)

## Acknowledgments

- Inspired by common pain points in CI/CD workflows
- Built with TypeScript for type safety
- Uses [unconfig](https://github.com/antfu/unconfig) for flexible configuration

## Related Projects

- [download-github-release](https://github.com/robinvdvleuten/node-download-github-release) - Alternative tool
- [get-release](https://github.com/tauri-apps/tauri/tree/dev/tooling/cli/node) - Tauri's approach

---

**Star this repo if you find it useful!** ⭐
