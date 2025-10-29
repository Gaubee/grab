/**
 * @fileoverview `grab init` command implementation
 * Initialize a grab configuration file
 */

import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";

export interface InitCommandOptions {
  template?: string;
  force?: boolean;
  interactive?: boolean;
}

// Configuration templates
const TEMPLATES = {
  simple: `/**
 * Grab configuration file
 * @see https://github.com/Gaubee/grab
 */
export default {
  // GitHub repository (owner/repo)
  repo: "REPO_PLACEHOLDER",

  // Platform and architecture (auto-detected if not specified)
  // platform: "linux",  // linux, darwin, windows
  // arch: "x64",        // x64, arm64, x86, arm

  // Output options
  // output: "./downloads",  // Where to save the downloaded file
  // extract: true,          // Auto-extract archives
  // cleanup: true,          // Delete archive after extraction

  // Version
  tag: "latest",
};
`,

  multi: `/**
 * Grab configuration file - Multiple assets
 * @see https://github.com/Gaubee/grab
 */
import { unzip, copy, clear } from "@gaubee/grab/plugins";

export default {
  // Download multiple assets
  assets: [
    {
      repo: "REPO_PLACEHOLDER_1",
      name: ["linux", "x64"],
      plugins: [
        unzip(),
        copy({ sourcePath: "binary", targetPath: "./bin/binary1" }),
        clear(),
      ],
    },
    {
      repo: "REPO_PLACEHOLDER_2",
      name: ["linux", "x64"],
      plugins: [
        unzip(),
        copy({ sourcePath: "binary", targetPath: "./bin/binary2" }),
        clear(),
      ],
    },
  ],

  // Global options
  tag: "latest",
  concurrency: 4,
};
`,

  advanced: `/**
 * Grab configuration file - Advanced
 * @see https://github.com/Gaubee/grab
 */
import { unzip, copy, clear } from "@gaubee/grab/plugins";

export default {
  repo: "REPO_PLACEHOLDER",

  assets: [
    {
      name: ["linux", "x64"],
      plugins: [
        unzip(),
        copy({ sourcePath: "binary", targetPath: "./bin/binary" }),
        clear(),
      ],
    },
  ],

  // Lifecycle hooks
  hooks: {
    onTagFetched: async (tag) => {
      console.log(\`Downloading version: \${tag}\`);
      // You can add custom logic here
    },
    onAssetDownloadComplete: async (asset) => {
      console.log(\`Downloaded: \${asset.fileName}\`);
      // You can send notifications, update files, etc.
    },
  },

  // Global configuration
  tag: "latest",
  concurrency: 4,
  maxRetries: 3,

  // Proxy configuration
  // useProxy: true,
  // proxyUrl: "https://ghfast.top/{{href}}",
};
`,
};

/**
 * Check if config file exists
 */
async function configExists(): Promise<boolean> {
  const configPaths = [
    "grab.config.ts",
    "grab.config.js",
    "grab.config.mjs",
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Interactive prompt (simplified version without inquirer)
 */
async function prompt(question: string, defaultValue?: string): Promise<string> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const promptText = defaultValue
      ? `${question} (${defaultValue}): `
      : `${question}: `;

    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

/**
 * Execute the `grab init` command
 */
export async function initCommand(options: InitCommandOptions): Promise<void> {
  const { template = "simple", force = false, interactive = true } = options;

  // Check if config already exists
  if (!force && await configExists()) {
    throw new Error(
      "Configuration file already exists.\n" +
      "Use --force to overwrite."
    );
  }

  let selectedTemplate = template;
  let repo = "";

  // Interactive mode
  if (interactive) {
    console.log("\n\x1b[1mCreate grab configuration\x1b[0m\n");

    // Ask for template
    console.log("Available templates:");
    console.log("  1. simple   - Single asset download (recommended)");
    console.log("  2. multi    - Multiple assets download");
    console.log("  3. advanced - With hooks and plugins");
    console.log();

    const templateChoice = await prompt("Choose template (1-3)", "1");
    const templateMap: Record<string, string> = {
      "1": "simple",
      "2": "multi",
      "3": "advanced",
    };
    selectedTemplate = templateMap[templateChoice] || template;

    // Ask for repo
    if (selectedTemplate === "simple") {
      repo = await prompt("Repository (owner/repo)", "");
    }

    console.log();
  }

  // Validate template
  if (!TEMPLATES[selectedTemplate as keyof typeof TEMPLATES]) {
    throw new Error(
      `Unknown template: "${selectedTemplate}"\n` +
      `Available templates: ${Object.keys(TEMPLATES).join(", ")}`
    );
  }

  // Get template content
  let content = TEMPLATES[selectedTemplate as keyof typeof TEMPLATES];

  // Replace placeholders
  if (repo) {
    content = content.replace(/REPO_PLACEHOLDER(_\d+)?/g, repo);
  } else {
    content = content.replace(/REPO_PLACEHOLDER(_\d+)?/g, (match) => {
      // Keep unique placeholders for multi template
      return match;
    });
  }

  // Write config file
  const configPath = "grab.config.ts";
  await fs.writeFile(configPath, content, "utf-8");

  console.log(`\x1b[32m✓\x1b[0m Created ${configPath}`);
  console.log();
  console.log("Next steps:");
  console.log("  1. Edit grab.config.ts to configure your downloads");
  console.log("  2. Run 'grab' to download assets");
  console.log();

  if (!repo || content.includes("REPO_PLACEHOLDER")) {
    console.log("\x1b[33m⚠\x1b[0m Don't forget to replace REPO_PLACEHOLDER with your repository!");
    console.log();
  }
}
