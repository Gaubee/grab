# Grab SDK - CLI-First 重构工作计划

## 设计哲学转变

### 核心理念

**从 Config-First → CLI-First**

- **当前问题**: 必须先创建 `grab.config.ts` 才能使用，对于简单的一次性下载过于繁琐
- **新理念**: CLI 应该能独立完成所有常见任务，配置文件仅用于：
  1. **固化重复的命令行参数**（避免每次输入相同内容）
  2. **扩展 CLI 无法做到的高级功能**（自定义插件、钩子、复杂逻辑）

### 设计原则

1. **零配置可用** - `grab <repo>` 即可完成基本下载
2. **渐进复杂度** - 从简单到复杂，按需添加参数
3. **配置文件可选** - 只在需要高级功能时才创建
4. **CLI 优先级高于配置** - 命令行参数覆盖配置文件
5. **智能默认值** - 自动检测平台、架构等

---

## 一、CLI 接口重新设计

### 1.1 核心命令设计

#### 基础用法（零配置）

```bash
# 下载当前平台的最新版本（自动检测平台和架构）
grab <repo>

# 示例
grab oven-sh/bun
# → 自动检测: linux-x64 或 darwin-arm64 等
# → 下载到: ./downloads/<filename>
# → 如果是压缩包，提示是否解压
```

#### 指定平台和架构

```bash
grab <repo> [options]

选项:
  --platform, -p <platform>    平台 (linux, darwin, windows)
  --arch, -a <arch>            架构 (x64, arm64, amd64, 386)
  --tag, -t <tag>              版本标签 (默认: latest)
  --output, -o <path>          输出路径 (默认: ./downloads)
  --extract, -e                自动解压
  --cleanup, -c                解压后删除压缩包
  --name, -n <pattern>         文件名匹配模式
```

#### 完整示例

```bash
# 示例 1: 下载 bun 的 Linux x64 版本到指定位置
grab oven-sh/bun --platform linux --arch x64 -o ./bin/bun --extract --cleanup

# 示例 2: 下载特定版本
grab oven-sh/bun --tag v1.0.30 -o ./bin/bun

# 示例 3: 使用文件名匹配（不使用平台/架构推断）
grab oven-sh/bun --name "bun-linux-x64-baseline.zip" -o ./downloads

# 示例 4: 下载但不处理
grab oven-sh/bun --platform linux --arch x64
# → 只下载到 ./downloads，不解压，不移动

# 示例 5: 交互模式
grab oven-sh/bun --interactive
# → TUI 选择平台、架构、版本、输出位置等
```

### 1.2 子命令设计

```bash
# 查看可用的 release assets
grab list <repo> [--tag <tag>]
# 示例:
grab list oven-sh/bun
grab list oven-sh/bun --tag v1.0.30

# 初始化配置文件
grab init [--template <template>]
# 示例:
grab init                           # 交互式创建
grab init --template simple         # 使用简单模板
grab init --template multi-asset    # 多资源模板

# 缓存管理
grab cache --status                 # 查看缓存状态
grab cache --clean                  # 清理过期缓存
grab cache --clear                  # 清空所有缓存
grab cache --list                   # 列出所有缓存项

# 配置验证
grab validate [config-file]         # 验证配置文件
grab validate grab.config.ts

# 查看版本和帮助
grab --version, -v                  # 版本号
grab --help, -h                     # 帮助信息
grab <command> --help               # 子命令帮助
```

### 1.3 参数优先级

```
CLI 参数 > 环境变量 > 配置文件 > 默认值
```

**示例**:

```bash
# grab.config.ts
export default {
  repo: "oven-sh/bun",
  assets: [{
    name: ["linux", "x64"],
    targetPath: "./bin/bun"
  }],
  tag: "v1.0.30"
}

# 命令行覆盖配置
grab --tag v1.0.31 -o ./bin/bun-new
# → 使用 v1.0.31（覆盖配置的 v1.0.30）
# → 输出到 ./bin/bun-new（覆盖配置的 ./bin/bun）
# → repo 仍然使用配置文件的 "oven-sh/bun"
```

### 1.4 环境变量支持

```bash
# 环境变量
GRAB_PROXY_URL=https://ghfast.top/{{href}}
GRAB_CACHE_DIR=~/.cache/grab
GRAB_PLATFORM=linux
GRAB_ARCH=x64
GRAB_GITHUB_TOKEN=ghp_xxxx

# 使用
GRAB_PLATFORM=linux GRAB_ARCH=arm64 grab oven-sh/bun
```

---

## 二、配置文件的新定位

### 2.1 配置文件是可选的

**何时需要配置文件？**

1. ✅ **需要下载多个资源** - CLI 一次只能下载一个
2. ✅ **需要自定义插件逻辑** - CLI 只支持内置操作
3. ✅ **需要生命周期钩子** - 注入自定义业务逻辑
4. ✅ **需要固化重复的命令行参数** - 避免每次输入
5. ✅ **需要复杂的资源匹配规则** - CLI 只支持简单匹配
6. ✅ **需要团队共享配置** - 纳入版本控制

**何时不需要配置文件？**

1. ✅ **一次性下载单个文件** - 直接用 CLI
2. ✅ **简单的下载和解压** - CLI 足够
3. ✅ **尝试和实验** - CLI 更快

### 2.2 配置文件的两种模式

#### 模式 1: 简化模式（固化 CLI 参数）

```typescript
// grab.config.ts
export default {
  // 等价于: grab oven-sh/bun --platform linux --arch x64 -o ./bin/bun --extract --cleanup
  repo: "oven-sh/bun",
  platform: "linux",
  arch: "x64",
  output: "./bin/bun",
  extract: true,
  cleanup: true,
  tag: "latest"
}
```

使用:
```bash
grab  # 读取配置文件，相当于执行上面的完整命令
grab --tag v1.0.31  # 覆盖 tag，其他使用配置
```

#### 模式 2: 高级模式（扩展功能）

```typescript
// grab.config.ts
import { unzip, copy, clear } from '@gaubee/grab/plugins';

export default {
  // 下载多个资源
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

  // 生命周期钩子
  hooks: {
    onTagFetched: async (tag) => {
      await fs.writeFile(".version", tag);
      console.log(`Downloading version: ${tag}`);
    },
    onAssetDownloadComplete: async (asset) => {
      await sendNotification(`Downloaded ${asset.fileName}`);
    }
  },

  // 全局配置
  concurrency: 4,
  maxRetries: 3,
  useProxy: true,
  proxyUrl: "https://ghfast.top/{{href}}"
}
```

使用:
```bash
grab  # 下载所有配置的资源
```

### 2.3 配置文件的智能合并

```typescript
// grab.config.ts
export default {
  // 默认配置（可被 CLI 覆盖）
  defaults: {
    platform: "linux",
    arch: "x64",
    extract: true,
    cleanup: true,
    output: "./downloads"
  },

  // 仓库别名（简化 CLI 使用）
  aliases: {
    "bun": "oven-sh/bun",
    "deno": "denoland/deno",
    "node": "nodejs/node"
  },

  // 预设配置
  presets: {
    "bun-latest": {
      repo: "oven-sh/bun",
      platform: "linux",
      arch: "x64",
      output: "./bin/bun",
      extract: true
    }
  }
}
```

使用:
```bash
# 使用别名
grab bun  # → 等价于 grab oven-sh/bun

# 使用预设
grab --preset bun-latest

# CLI 参数覆盖默认值
grab oven-sh/bun  # 使用 defaults 中的配置
grab oven-sh/bun --arch arm64  # 覆盖默认的 x64
```

---

## 三、实现计划

### 阶段 1: 基础 CLI 重构 (1-2 周)

#### 目标
让 `grab <repo>` 能够零配置工作

#### 任务清单

- [ ] **重构 CLI 参数解析**
  - [ ] 支持位置参数 `<repo>`
  - [ ] 添加新的参数: `--platform`, `--arch`, `--output`, `--extract`, `--cleanup`
  - [ ] 实现智能平台检测 (基于 `process.platform` 和 `process.arch`)
  - [ ] 支持 `--name` 模式匹配（不使用平台/架构推断）

- [ ] **实现资源智能匹配**
  - [ ] 基于平台/架构推断文件名模式
  - [ ] 支持常见的命名规范:
    - `{name}-{platform}-{arch}.{ext}` (如 bun-linux-x64.zip)
    - `{name}-{arch}-{platform}.{ext}` (如 bun-x64-linux.zip)
    - `{name}_{platform}_{arch}.{ext}` (如 node_linux_x64.tar.gz)
  - [ ] 处理架构别名: `x86_64` = `x64` = `amd64`
  - [ ] 处理平台别名: `darwin` = `macos` = `osx`

- [ ] **实现内置后处理**
  - [ ] `--extract` 自动解压 (支持 .zip, .tar.gz, .tgz)
  - [ ] `--cleanup` 删除原始压缩包
  - [ ] `--output` 移动/重命名最终文件

- [ ] **改进错误提示**
  - [ ] 找不到匹配文件时，列出所有可用文件
  - [ ] 建议可能的匹配选项
  - [ ] 配置文件不存在时，不报错（改为使用 CLI 参数）

#### 示例代码结构

```typescript
// cli.ts
async function run(argv: string[]) {
  const args = await parseArgs(argv);

  // 1. 确定数据源
  let config: Partial<GrabConfig>;

  if (configFileExists()) {
    config = await loadConfig();
  } else {
    config = {}; // 空配置，使用 CLI 参数
  }

  // 2. 合并 CLI 参数（优先级更高）
  const options = mergeOptions(config, args);

  // 3. 智能推断缺失的参数
  if (!options.platform) {
    options.platform = detectPlatform();
  }
  if (!options.arch) {
    options.arch = detectArch();
  }

  // 4. 构建资源匹配模式
  const asset = buildAsset(options);

  // 5. 执行下载
  const provider = new GithubReleaseProvider(options.repo);
  const downloader = createDownloader(provider, [asset], {});
  await downloader(options);
}

function detectPlatform(): string {
  const platform = process.platform;
  switch (platform) {
    case 'darwin': return 'darwin';
    case 'win32': return 'windows';
    case 'linux': return 'linux';
    default: throw new Error(`Unsupported platform: ${platform}`);
  }
}

function detectArch(): string {
  const arch = process.arch;
  switch (arch) {
    case 'x64': return 'x64';
    case 'arm64': return 'arm64';
    case 'ia32': return 'x86';
    default: throw new Error(`Unsupported architecture: ${arch}`);
  }
}

function buildAsset(options: CLIOptions): Asset {
  if (options.name) {
    // 使用精确名称匹配
    return { name: options.name };
  } else {
    // 使用平台/架构推断
    const patterns = [
      `${options.platform}`,
      `${options.arch}`
    ];
    return { name: patterns };
  }
}
```

### 阶段 2: 子命令实现 (1 周)

#### 任务清单

- [ ] **实现 `grab list`**
  - [ ] 调用 GitHub API 获取 release 信息
  - [ ] 格式化输出所有可用的 assets
  - [ ] 支持 `--tag` 参数查看特定版本
  - [ ] 支持 `--json` 输出 JSON 格式

- [ ] **实现 `grab init`**
  - [ ] 交互式问答生成配置
  - [ ] 提供多个模板:
    - `simple` - 单个资源下载
    - `multi` - 多个资源下载
    - `advanced` - 包含 hooks 和插件
  - [ ] 检测已有配置文件，询问是否覆盖

- [ ] **实现 `grab cache`**
  - [ ] `--status` 显示缓存统计
  - [ ] `--list` 列出所有缓存项
  - [ ] `--clean` 清理超过 N 天的缓存
  - [ ] `--clear` 清空所有缓存
  - [ ] 支持 `--dry-run` 预览操作

- [ ] **实现 `grab validate`**
  - [ ] 验证配置文件语法
  - [ ] 检查必填字段
  - [ ] 验证 repo 格式
  - [ ] 验证 assets 配置

#### 示例输出

```bash
$ grab list oven-sh/bun

Release: v1.1.38 (2025-10-28)
Available assets (12):
  1. bun-darwin-aarch64.zip          (45.2 MB)
  2. bun-darwin-x64.zip              (47.1 MB)
  3. bun-linux-aarch64.zip           (42.8 MB)
  4. bun-linux-x64.zip               (43.5 MB)
  5. bun-linux-x64-baseline.zip      (43.7 MB)
  6. bun-windows-x64.zip             (48.2 MB)
  ...

Suggested commands:
  grab oven-sh/bun --name "bun-linux-x64.zip"
  grab oven-sh/bun --platform linux --arch x64
```

```bash
$ grab cache --status

Cache location: /home/user/.cache/grab
Total size: 245.3 MB
Total items: 12

Recently used:
  1. bun-linux-x64.zip (v1.1.38)     43.5 MB   2 hours ago
  2. deno-linux-x64.zip (v2.1.0)     52.1 MB   1 day ago
  3. node-linux-x64.tar.gz (v22.0)   68.2 MB   3 days ago

Run 'grab cache --clean' to remove items older than 30 days
Run 'grab cache --clear' to remove all cached items
```

### 阶段 3: 配置文件增强 (1 周)

#### 任务清单

- [ ] **支持简化配置模式**
  - [ ] 允许顶层直接配置单个资源
  - [ ] 支持 `defaults` 字段设置默认值
  - [ ] 支持 `aliases` 字段定义仓库别名
  - [ ] 支持 `presets` 字段定义预设配置

- [ ] **实现配置合并逻辑**
  - [ ] CLI 参数覆盖配置文件
  - [ ] 环境变量覆盖配置文件
  - [ ] 清晰的优先级规则

- [ ] **向后兼容**
  - [ ] 支持旧的 `assets` 数组格式
  - [ ] 在新旧格式混用时给出警告
  - [ ] 提供迁移工具

#### 配置文件示例

```typescript
// 简化模式
export default {
  repo: "oven-sh/bun",
  platform: "linux",
  arch: "x64",
  output: "./bin/bun",
  extract: true,
  cleanup: true
}

// 带默认值
export default {
  defaults: {
    platform: "linux",
    arch: "x64",
    extract: true
  },
  repo: "oven-sh/bun",
  output: "./bin/bun"
}

// 带别名和预设
export default {
  aliases: {
    bun: "oven-sh/bun",
    deno: "denoland/deno"
  },
  presets: {
    "bun-latest": {
      repo: "bun",
      output: "./bin/bun",
      extract: true
    }
  }
}

// 高级模式（向后兼容）
export default {
  assets: [
    {
      repo: "oven-sh/bun",
      name: ["linux", "x64"],
      plugins: [unzip(), copy({ targetPath: "./bin/bun" })]
    }
  ]
}
```

### 阶段 4: 体验优化 (1 周)

#### 任务清单

- [ ] **智能建议**
  - [ ] 找不到匹配时，使用模糊匹配建议可能的选项
  - [ ] 检测到压缩包时，提示是否需要 `--extract`
  - [ ] 检测到配置文件时，提示可以省略 CLI 参数

- [ ] **进度显示优化**
  - [ ] 非交互模式显示简洁的进度条
  - [ ] 支持 `--quiet` 只显示错误
  - [ ] 支持 `--verbose` 显示详细日志
  - [ ] 支持 `--json` 输出 JSON 格式（用于脚本）

- [ ] **错误恢复**
  - [ ] 下载失败时，提供重试命令
  - [ ] 哈希验证失败时，提供清除缓存的建议
  - [ ] 网络错误时，建议使用代理

- [ ] **快捷操作**
  - [ ] `grab --latest <repo>` 快速更新到最新版本
  - [ ] `grab --update` 更新所有配置的资源
  - [ ] `grab --check` 检查是否有新版本但不下载

#### 示例交互

```bash
$ grab oven-sh/bun --platform linux --arch x64

✓ Detected platform: linux-x64
✓ Fetching release info...
✓ Found release: v1.1.38
✓ Matched asset: bun-linux-x64.zip (43.5 MB)
? This is a zip file. Extract it? (Y/n) y
? Where to extract? (./downloads) ./bin
✓ Downloading... [████████████████████] 100% (43.5 MB) 3.2 MB/s
✓ Verifying... OK
✓ Extracting... OK
✓ Saved to: ./bin/bun

✨ Done in 14.2s

Tip: Run 'grab init' to save this configuration for next time
```

```bash
$ grab oven-sh/bun --platform linux --arch arm64

✗ No matching asset found for: linux-arm64

Available assets in release v1.1.38:
  • bun-linux-x64.zip
  • bun-linux-x64-baseline.zip
  • bun-linux-aarch64.zip  ← Did you mean this?

Suggested command:
  grab oven-sh/bun --platform linux --arch aarch64
```

---

## 四、向后兼容策略

### 4.1 配置文件兼容

```typescript
// 旧格式（仍然支持）
export default {
  repo: "oven-sh/bun",
  assets: [
    {
      name: ["linux", "x64"],
      targetPath: "./bin/bun"
    }
  ]
}

// 新格式（推荐）
export default {
  repo: "oven-sh/bun",
  platform: "linux",
  arch: "x64",
  output: "./bin/bun"
}

// 混合格式（给出警告）
export default {
  repo: "oven-sh/bun",
  platform: "linux",  // ⚠️ Warning: 'platform' is ignored when 'assets' is present
  assets: [...]
}
```

### 4.2 迁移工具

```bash
$ grab migrate grab.config.ts

Found old-style configuration.

Current:
  repo: "oven-sh/bun"
  assets: [{ name: ["linux", "x64"], targetPath: "./bin/bun" }]

Suggested migration:
  repo: "oven-sh/bun"
  platform: "linux"
  arch: "x64"
  output: "./bin/bun"

? Apply migration? (Y/n)
```

### 4.3 弃用警告

```bash
$ grab

⚠ Warning: The 'assets' field is deprecated for single-resource downloads.
  Consider using the simplified format:

  export default {
    repo: "oven-sh/bun",
    platform: "linux",
    arch: "x64",
    output: "./bin/bun"
  }

  Run 'grab migrate' to automatically convert your config.

  This warning will become an error in v2.0.0
```

---

## 五、质量保证计划

### 5.1 测试计划

- [ ] **单元测试**
  - [ ] CLI 参数解析测试
  - [ ] 平台/架构检测测试
  - [ ] 资源匹配逻辑测试
  - [ ] 配置合并逻辑测试
  - [ ] 所有子命令测试

- [ ] **集成测试**
  - [ ] 端到端下载流程测试
  - [ ] 多种配置格式测试
  - [ ] CLI + 配置文件优先级测试
  - [ ] 错误场景测试

- [ ] **回归测试**
  - [ ] 确保旧配置文件仍然工作
  - [ ] 确保 API 向后兼容

### 5.2 文档计划

- [ ] **README.md**
  - [ ] 快速开始（5 分钟上手）
  - [ ] 常见用法示例
  - [ ] CLI 参数完整列表
  - [ ] 配置文件参考

- [ ] **用户指南**
  - [ ] 从 CLI 到配置文件的迁移指南
  - [ ] 高级功能教程（插件、钩子）
  - [ ] 故障排查指南

- [ ] **API 文档**
  - [ ] 类型定义文档
  - [ ] 插件开发指南
  - [ ] Provider 开发指南

---

## 六、示例场景对比

### 场景 1: 简单的一次性下载

**当前 (Config-First)**:
```bash
# 1. 创建配置文件
cat > grab.config.ts << EOF
export default {
  repo: "oven-sh/bun",
  assets: [{ name: ["linux", "x64"], targetPath: "./bin/bun" }]
}
EOF

# 2. 运行
npx @gaubee/grab
```

**改进后 (CLI-First)**:
```bash
# 一行搞定
grab oven-sh/bun --platform linux --arch x64 -o ./bin/bun --extract
```

---

### 场景 2: 重复下载（固化配置）

**当前 (Config-First)**:
```bash
# 每次都要有配置文件
npx @gaubee/grab
```

**改进后 (CLI-First)**:
```bash
# 第一次：使用 CLI
grab oven-sh/bun --platform linux --arch x64 -o ./bin/bun --extract

# 创建配置固化参数
grab init
? Repository: oven-sh/bun
? Platform: linux
? Architecture: x64
? Output: ./bin/bun
? Extract: yes
✓ Created grab.config.ts

# 以后：直接运行
grab
```

---

### 场景 3: 多资源下载（必须用配置文件）

**当前 (Config-First)**:
```typescript
// grab.config.ts
export default {
  assets: [
    { repo: "oven-sh/bun", name: ["linux", "x64"], targetPath: "./bin/bun" },
    { repo: "denoland/deno", name: ["linux", "x86_64"], targetPath: "./bin/deno" }
  ]
}
```

**改进后 (CLI-First)**:
```typescript
// grab.config.ts
export default {
  assets: [
    { repo: "oven-sh/bun", platform: "linux", arch: "x64", output: "./bin/bun" },
    { repo: "denoland/deno", platform: "linux", arch: "x64", output: "./bin/deno" }
  ]
}
```

```bash
# CLI 也可以连续下载
grab oven-sh/bun -o ./bin/bun --extract && \
grab denoland/deno -o ./bin/deno --extract

# 但配置文件更简洁
grab
```

---

### 场景 4: 探索可用版本

**当前 (Config-First)**:
```bash
# 需要去 GitHub 网页查看
open https://github.com/oven-sh/bun/releases
```

**改进后 (CLI-First)**:
```bash
# 直接在命令行查看
grab list oven-sh/bun

# 查看特定版本
grab list oven-sh/bun --tag v1.0.30
```

---

## 七、时间线

### 第 1 周: 基础 CLI 重构
- Day 1-2: 重构参数解析和智能检测
- Day 3-4: 实现资源智能匹配
- Day 5-7: 实现内置后处理和测试

### 第 2 周: 子命令实现
- Day 1-2: 实现 `grab list`
- Day 3-4: 实现 `grab init`
- Day 5-6: 实现 `grab cache` 和 `grab validate`
- Day 7: 测试和文档

### 第 3 周: 配置文件增强
- Day 1-3: 实现简化配置模式
- Day 4-5: 实现配置合并逻辑
- Day 6-7: 向后兼容测试

### 第 4 周: 体验优化和文档
- Day 1-2: 智能建议和错误恢复
- Day 3-4: 进度显示优化
- Day 5-7: README、用户指南、API 文档

---

## 八、成功指标

### 用户体验指标

- [ ] **零配置可用**: 新用户无需阅读文档即可完成基本下载
- [ ] **错误自解释**: 90% 的错误信息包含解决建议
- [ ] **文档完整**: 所有功能都有示例
- [ ] **向后兼容**: 旧配置文件 100% 可用

### 代码质量指标

- [ ] **测试覆盖率**: > 80%
- [ ] **类型安全**: 0 个 `any` 类型
- [ ] **性能**: 下载速度与 `wget` 相当
- [ ] **可维护性**: 核心逻辑有完整注释

### 社区指标

- [ ] **GitHub Stars**: > 100
- [ ] **npm 周下载**: > 1000
- [ ] **Issues 响应时间**: < 24 小时
- [ ] **贡献者**: > 5 人

---

## 九、风险和挑战

### 风险 1: 向后兼容性破坏

**问题**: 重构可能导致旧代码无法运行

**缓解**:
- 保留旧 API，标记为 deprecated
- 提供迁移工具和清晰的迁移指南
- 在主版本升级前至少保留一个版本的兼容期

### 风险 2: CLI 参数过多导致复杂度上升

**问题**: 为了覆盖所有场景，CLI 参数可能变得很多

**缓解**:
- 只在 CLI 中暴露最常用的参数
- 复杂功能引导用户使用配置文件
- 使用子命令组织功能

### 风险 3: 资源匹配的模糊性

**问题**: 自动匹配可能下载错误的文件

**缓解**:
- 匹配前显示将要下载的文件，询问确认
- 提供 `--name` 参数用于精确匹配
- 记录匹配逻辑，方便调试

---

## 十、总结

这个重构计划将 Grab SDK 从 **Config-First** 转变为 **CLI-First**，核心改进：

1. **零配置可用** - `grab <repo>` 即可开始
2. **渐进复杂度** - 从简单 CLI 到高级配置的平滑过渡
3. **配置文件可选** - 只在需要高级功能时才创建
4. **智能默认值** - 自动检测平台和架构
5. **友好的错误提示** - 不仅说出错了，还说怎么解决

通过这些改进，Grab SDK 将成为一个**真正易用**的 GitHub Release 下载工具。
