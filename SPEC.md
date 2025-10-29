# Grab SDK - 技术规格说明书

## 一、立项初衷

### 1.1 核心动机

在现代软件开发中，开发者经常需要从 GitHub Releases 下载特定平台和架构的二进制文件（如编译器、工具链、依赖库等）。这个看似简单的需求，却存在诸多痛点：

1. **手动操作繁琐** - 需要打开浏览器，找到对应的 Release 页面，手动识别和下载正确的资源
2. **命名不一致** - 不同项目的命名规则各异（如 `linux-x64`, `x86_64-linux`, `amd64-linux` 等）
3. **后处理复杂** - 下载后常需要解压、重命名、移动到指定位置
4. **网络问题** - 国内访问 GitHub 下载速度慢甚至失败
5. **无法自动化** - 难以集成到 CI/CD 流程或项目初始化脚本中
6. **完整性验证** - 需要手动验证文件哈希，确保下载完整

### 1.2 设计愿景

Grab SDK 的愿景是：**让从 GitHub Release 下载资源像配置依赖一样简单**。

就像 `package.json` 声明 npm 依赖一样，开发者只需在 `grab.config.ts` 中声明需要的资源，工具自动处理所有细节：

```typescript
// grab.config.ts
export default {
  repo: "oven-sh/bun",
  assets: [
    {
      name: ["linux", "x64"],
      plugins: [unzip(), copy({ targetPath: "./bin/bun" })],
    },
  ],
}
```

一行命令即可完成下载、验证、解压、安装：

```bash
npx @gaubee/grab
```

---

## 二、要解决的问题

### 2.1 核心问题域

Grab SDK 聚焦于解决以下核心问题：

#### 问题 1：资源定位与匹配

**问题描述**：不同项目的 Release 资源命名规则千差万别，开发者需要手动识别正确的文件。

**解决方案**：
- 支持**关键词数组匹配**：`["linux", "x64"]` 自动匹配包含这些关键词的资源
- 支持**精确名称匹配**：`"my-tool-v1.0.0.tar.gz"` 直接匹配完整文件名
- 提供 **Provider 抽象**：未来可扩展支持其他版本源（如 GitLab Release, 自建服务器等）

#### 问题 2：下载可靠性

**问题描述**：网络不稳定导致下载失败或文件损坏。

**解决方案**：
- **断点续传**：基于 HTTP Range 请求实现
- **ETag 缓存**：避免重复下载已获取的文件
- **哈希验证**：自动验证文件完整性（基于 GitHub 提供的 digest）
- **自动重试**：下载失败自动重试（最多 3 次）
- **代理支持**：内置国内镜像加速（如 `ghfast.top`）

#### 问题 3：后处理自动化

**问题描述**：下载后需要解压、重命名、移动文件等操作。

**解决方案**：
- **插件系统**：提供标准化的后处理插件
  - `unzip()` - 自动解压 `.zip` 和 `.tar.gz` 文件
  - `copy()` - 将文件复制到目标位置
  - `clear()` - 清理临时文件
- **自定义插件**：开发者可编写自定义插件扩展功能

#### 问题 4：多模式支持

**问题描述**：不同环境对下载工具的依赖不同（如 Docker 容器内只有 `curl`）。

**解决方案**：
- 支持多种下载模式：
  - `fetch`（默认）- 使用 Node.js 内置 fetch API
  - `wget` - 使用系统的 wget 命令
  - `curl` - 使用系统的 curl 命令
  - 自定义命令模板 - 如 `aria2c -o $DOWNLOAD_FILE $DOWNLOAD_URL`
  - 自定义函数 - 完全控制下载逻辑

#### 问题 5：集成与自动化

**问题描述**：难以集成到现有的开发工具链中。

**解决方案**：
- **声明式配置**：`grab.config.ts` 可纳入版本控制
- **生命周期钩子**：支持注入自定义逻辑（如更新版本号、通知等）
- **CLI 与 SDK**：既可作为命令行工具使用，也可作为 Node.js 库集成
- **交互式 TUI**：可选的交互式界面，实时显示下载进度

---

##三、解决问题的哲学

### 3.1 设计原则

Grab SDK 的设计遵循以下核心原则：

#### 1. 声明式配置（Declarative Configuration）

**原则**：用户只需声明"要什么"（what），而非"怎么做"（how）。

**体现**：
```typescript
// 声明式 - 清晰表达意图
export default {
  repo: "oven-sh/bun",
  assets: [
    { name: ["linux", "x64"], targetPath: "./bin/bun" }
  ]
}

// 而非命令式 - 暴露实现细节
fetchRelease("oven-sh/bun")
  .then(findAssetByKeywords(["linux", "x64"]))
  .then(downloadFile)
  .then(verifyHash)
  .then(copyTo("./bin/bun"))
```

#### 2. 关注点分离（Separation of Concerns）

**原则**：将不同职责清晰分离，各司其职。

**体现**：
- **Provider** - 负责与版本源交互（如 GitHub API）
- **Downloader** - 负责文件下载和验证
- **Plugin** - 负责后处理逻辑
- **Config** - 负责配置加载和验证

每个模块都有明确的单一职责，易于理解和扩展。

#### 3. 可扩展性优先（Extensibility First）

**原则**：提供清晰的扩展点，而非封闭系统。

**体现**：
- **Provider 接口**：可扩展支持新的版本源
  ```typescript
  interface ReleaseProvider {
    getLatestTag(): Promise<string>
    resolveAssets(tag: string, assets: Asset[]): Promise<ResolvedAsset[]>
  }
  ```
- **Plugin 系统**：可编写自定义后处理插件
  ```typescript
  type AssetPlugin = (context: PluginContext) => Promise<void>
  ```
- **下载模式**：可自定义下载策略
  ```typescript
  type DownloadMode = "fetch" | "wget" | "curl" | string | string[] | CustomDownloaderFunction
  ```

#### 4. 渐进增强（Progressive Enhancement）

**原则**：提供合理的默认值，支持渐进式配置复杂度。

**体现**：
```typescript
// 最简配置 - 开箱即用
export default {
  repo: "oven-sh/bun",
  assets: [{ name: "bun-linux-x64.zip" }]
}

// 中等配置 - 添加后处理
export default {
  repo: "oven-sh/bun",
  assets: [{
    name: ["linux", "x64"],
    plugins: [unzip(), copy({ targetPath: "./bin/bun" })]
  }]
}

// 高级配置 - 完全控制
export default {
  repo: "oven-sh/bun",
  assets: [{ ... }],
  hooks: {
    onTagFetched: async (tag) => { /* 自定义逻辑 */ },
    getAssetCache: async (asset) => { /* 自定义缓存策略 */ }
  }
}
```

#### 5. 可靠性至上（Reliability First）

**原则**：下载工具的首要目标是可靠，其次才是速度。

**体现**：
- **强制哈希验证**：无法跳过完整性检查
- **状态机模型**：清晰定义所有可能的状态转换
- **错误处理**：详细的错误信息和自动重试机制
- **类型安全**：完整的 TypeScript 类型定义

### 3.2 技术哲学

#### 第一性原理思考

从"下载文件"这个第一性原理出发，Grab SDK 将问题分解为：

1. **发现资源** - 从版本源获取可下载资源的元数据
2. **下载文件** - 通过网络获取文件内容
3. **验证完整性** - 确保下载内容正确无损
4. **后处理** - 将文件放置到最终位置

每一步都是独立且可替换的，而非紧耦合的整体。

#### 面向接口编程

核心模块都基于接口定义：

```typescript
// Provider 接口 - 抽象版本源
interface ReleaseProvider {
  getLatestTag(): Promise<string>
  resolveAssets(tag: string, assets: Asset[]): Promise<ResolvedAsset[]>
}

// Plugin 接口 - 抽象后处理
type AssetPlugin = (context: PluginContext) => Promise<void>

// Hooks 接口 - 抽象生命周期
interface LifecycleHooks {
  onTagFetched?: (tag: string) => Promise<void> | void
  getAssetCache?: (asset: DownloadAsset) => Promise<{ etag?: string } | undefined>
  // ...
}
```

这使得实现可以替换，而不影响核心逻辑。

#### 函数式与组合

插件系统采用函数组合的思想：

```typescript
assets: [{
  name: ["linux", "x64"],
  plugins: [
    unzip(),                              // 步骤 1：解压
    copy({ targetPath: "./bin/bun" }),    // 步骤 2：复制
    clear()                               // 步骤 3：清理
  ]
}]
```

每个插件都是纯函数，接收 context，执行操作，返回 Promise。插件之间通过 context 共享状态，但彼此独立。

---

## 四、架构设计

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      CLI / SDK 入口                       │
│                   (cli.ts / index.ts)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    Config Loader                         │
│              (unconfig - grab.config.ts)                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                 Factory (createDownloader)               │
│          组装 Provider + Assets + Hooks                  │
└─────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           ↓              ↓              ↓
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Provider │   │   Core   │   │  Plugin  │
    │  (抽象)   │   │ (下载器) │   │  (后处理) │
    └──────────┘   └──────────┘   └──────────┘
           │              │              │
           ↓              ↓              ↓
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ GitHub   │   │ Fetch/   │   │ unzip/   │
    │ Release  │   │ wget/    │   │ copy/    │
    │ API      │   │ curl     │   │ clear    │
    └──────────┘   └──────────┘   └──────────┘
```

### 4.2 核心模块

#### 4.2.1 Config 模块

**职责**：加载和验证配置文件

**关键技术**：
- 使用 `unconfig` 库支持 `.ts/.js/.json` 多种格式
- 自动搜索当前目录及父目录
- TypeScript 类型定义确保配置正确性

**核心类型**：
```typescript
interface GrabConfig {
  repo: string                // GitHub 仓库 (owner/repo)
  assets: Asset[]             // 资源列表
  hooks?: LifecycleHooks      // 生命周期钩子
  tag?: string                // 默认 tag
  useProxy?: boolean          // 是否使用代理
  proxyUrl?: string           // 代理 URL 模板
}
```

#### 4.2.2 Provider 模块

**职责**：抽象版本源交互，负责资源发现和解析

**设计模式**：接口 + 实现

**Provider 接口**：
```typescript
interface ReleaseProvider {
  getLatestTag(): Promise<string>
  resolveAssets(tag: string, assets: Asset[]): Promise<ResolvedAsset[]>
}
```

**GithubReleaseProvider 实现**：
- 调用 GitHub API (`/repos/{owner}/{repo}/releases`)
- 缓存 Release 数据避免重复请求
- 支持 `latest` tag 和具体 tag
- 智能匹配资源名称（精确匹配 + 关键词匹配）

**扩展性**：未来可实现 `GitlabReleaseProvider`, `CustomServerProvider` 等

#### 4.2.3 Core 模块

**职责**：核心下载逻辑，包括文件下载、验证、状态管理

**核心函数**：

1. **downloadAsset** - 下载单个资源
   - 支持多种下载模式（fetch/wget/curl/自定义）
   - 支持断点续传（HTTP Range）
   - 支持 ETag 缓存
   - 实时进度报告

2. **verifyAsset** - 验证文件完整性
   - 计算文件哈希（sha256/sha512 等）
   - 与 GitHub 提供的 digest 对比
   - 不匹配时抛出 `HashMismatchError`

3. **clearAssetCache** - 清除缓存
   - 删除本地文件
   - 清除 ETag 记录

**状态机模型**：

```
pending → downloading ──→ verifying ──→ succeeded
              │               │
              ↓               ↓
          retrying ←──── failed
              │
              ↓ (max retries)
           failed
```

**关键设计**：
- 所有状态通过 `emitter` 回调报告给上层
- 状态对象包含完整上下文（filename, url, progress, error 等）
- 使用 TypeScript 联合类型确保状态安全

#### 4.2.4 Factory 模块

**职责**：组装下载器，提供统一的下载入口

**核心函数**：`createDownloader(provider, assets, hooks)`

**返回值**：`doDownload` 函数 + `retryFailedAssets` 方法

**关键逻辑**：
1. 解析 tag（`latest` → 实际版本号）
2. 调用 Provider 解析资源列表
3. 创建下载队列
4. 并发下载（默认 4 个并发）
5. 下载完成后执行插件
6. 触发生命周期钩子

**并发控制**：
```typescript
const workers = Array(concurrency)
  .fill(null)
  .map(async () => {
    while (downloadQueue.length > 0) {
      const asset = downloadQueue.shift()
      if (asset) await processAsset(asset)
    }
  })
await Promise.all(workers)
```

#### 4.2.5 Plugin 模块

**职责**：提供标准化的后处理插件

**插件接口**：
```typescript
type AssetPlugin = (context: PluginContext) => Promise<void>

interface PluginContext extends DownloadAsset {
  tag: string                   // 版本 tag
  fileName: string              // 文件名
  downloadedFilePath: string    // 下载路径
  downloadDirname: string       // 下载目录
  // ... 其他元数据
}
```

**内置插件**：

1. **unzip(options?)** - 自动解压
   - 支持 `.zip` (使用 unzipper)
   - 支持 `.tar.gz` (使用 tar)
   - 可指定解压子目录

2. **copy(options)** - 复制文件
   - 支持递归搜索源文件
   - 自动创建目标目录
   - 支持 `sourcePath` 和 `targetPath`

3. **clear()** - 清理临时文件
   - 删除原始下载的压缩包
   - 释放磁盘空间

**插件执行流程**：
```typescript
async function runPlugins(asset: DownloadAsset, tag: string) {
  // 自动添加 copy 插件（如果指定了 targetPath）
  if (asset.targetPath) {
    asset.plugins?.push(copy({ targetPath: asset.targetPath }))
  }

  // 顺序执行所有插件
  for (const plugin of asset.plugins) {
    await plugin(context)
  }
}
```

#### 4.2.6 CLI 模块

**职责**：命令行接口，参数解析，模式选择

**技术栈**：
- `yargs` - 命令行参数解析
- `ink` + `react` - 交互式 TUI（可选）

**支持的参数**：
```bash
--tag, -t          # 指定 release tag
--interactive, -i  # 启用交互式界面
--mode, -m         # 下载模式 (fetch/wget/curl)
--skip-download    # 跳过下载（用于测试）
--use-proxy, -p    # 启用代理
--proxy-url        # 代理 URL 模板
```

**执行流程**：
```typescript
async function run(argv: string[]) {
  // 1. 加载配置文件
  const config = await loadConfig()

  // 2. 解析命令行参数
  const args = await yargs(hideBin(argv))
    .option("tag", { ... })
    .option("interactive", { ... })
    .argv

  // 3. 创建下载器
  const provider = new GithubReleaseProvider(config.repo)
  const doDownload = createDownloader(provider, config.assets, config.hooks)

  // 4. 选择执行模式
  if (args.interactive) {
    fetchRender(doDownload, options)  // TUI 模式
  } else {
    await doDownload(options)         // CLI 模式
  }
}
```

### 4.3 数据流

```
1. User Input (CLI args / config file)
         │
         ↓
2. Config Loading (grab.config.ts)
         │
         ↓
3. Provider Resolution (GitHub API)
   Asset[] → ResolvedAsset[] (with downloadUrl, digest)
         │
         ↓
4. Downloader Factory
   ResolvedAsset[] → DownloadAsset[] (with downloadedFilePath)
         │
         ↓
5. Concurrent Download
   - fetch/wget/curl
   - progress reporting (emitter)
   - hash verification
         │
         ↓
6. Plugin Execution
   - unzip
   - copy
   - clear
         │
         ↓
7. Lifecycle Hooks
   - onAssetDownloadComplete
   - onAllComplete
         │
         ↓
8. Done
```

### 4.4 错误处理

#### 错误分类

1. **配置错误**
   - 配置文件不存在
   - 缺少必填字段 (repo, assets)
   - 类型不匹配

2. **网络错误**
   - GitHub API 请求失败
   - 下载连接中断
   - 代理不可用

3. **验证错误**
   - 哈希不匹配 (`HashMismatchError`)
   - 文件损坏

4. **资源错误**
   - Release tag 不存在
   - 找不到匹配的资源

5. **插件错误**
   - 解压失败
   - 文件操作权限不足

#### 错误处理策略

1. **配置错误** - 立即失败，提示用户修正
2. **网络错误** - 自动重试（最多 3 次）
3. **验证错误** - 清除缓存后重试
4. **资源错误** - 提示用户可用资源列表
5. **插件错误** - 中断流程，保留下载文件

### 4.5 缓存策略

#### 缓存层次

1. **Release 数据缓存** (内存级别)
   - Provider 内部缓存 GitHub API 响应
   - 避免重复请求同一 Release 的数据

2. **文件缓存** (磁盘级别)
   - 路径：`node_modules/.cache/grab/{digest-8-chars}/{filename}`
   - 基于 digest 组织，避免冲突
   - 支持多版本并存

3. **ETag 缓存** (通过 hooks)
   - 由用户通过 `getAssetCache` / `setAssetCache` 实现
   - 支持 HTTP 304 Not Modified

#### 缓存失效

- 哈希验证失败时，自动清除缓存文件和 ETag
- 用户可通过 `clear()` 插件手动清理

---

## 五、技术选型

### 5.1 核心依赖

| 依赖 | 版本 | 用途 | 选型理由 |
|------|------|------|---------|
| `typescript` | ^5.8 | 类型系统 | 提供完整的类型安全，IDE 支持友好 |
| `unconfig` | ^0.3 | 配置加载 | 支持多种配置格式，自动搜索配置文件 |
| `yargs` | ^18.0 | CLI 参数解析 | 成熟稳定，API 清晰 |
| `unzipper` | ^0.12 | ZIP 解压 | 纯 JS 实现，无需系统依赖 |
| `tar` | ^7.1 | tar.gz 解压 | 官方推荐，性能优秀 |
| `execa` | ^9.6 | 子进程管理 | 比 child_process 更易用，错误处理更好 |
| `@gaubee/util` | ^0.34 | 工具函数 | 作者内部工具库 |

### 5.2 开发依赖

| 依赖 | 用途 |
|------|------|
| `vitest` | 单元测试框架（比 Jest 更快） |
| `tsdown` | TypeScript 打包工具（生成 ESM bundle） |
| `ink` + `react` | 交互式 TUI 界面 |
| `prettier` | 代码格式化 |

### 5.3 技术决策

#### 为什么选择 TypeScript？

- **类型安全**：复杂的配置对象和状态机需要类型约束
- **IDE 支持**：用户编写 `grab.config.ts` 时有完整的代码提示
- **重构友好**：接口变更时编译器会报错

#### 为什么选择 unconfig？

- 支持 `.ts` / `.js` / `.json` 多种格式
- 自动搜索配置文件（当前目录及父目录）
- 对 TypeScript 配置文件的良好支持

#### 为什么选择 Node.js fetch API？

- Node.js 18+ 内置，无需额外依赖
- 支持 Web 标准 API（方便后续支持浏览器环境）
- 支持流式下载（`response.body.pipeTo`）

#### 为什么保留 wget/curl 支持？

- Docker 容器等环境可能没有 Node.js 的完整网络栈
- 某些场景下 wget/curl 的断点续传更可靠
- 用户可能有特定的代理配置

#### 为什么使用 execa 而非 child_process？

- API 更简洁（Promise-based）
- 更好的错误处理
- 更好的跨平台支持（如 Windows）

#### 为什么选择 vitest 而非 Jest？

- 更快的启动速度和执行速度
- 原生支持 ESM
- 与 Vite 生态集成良好

---

## 六、设计亮点

### 6.1 状态机驱动的进度报告

通过 `emitter` 回调，上层可以实时获取下载状态：

```typescript
await doDownload({
  emitter: (state) => {
    if (state.status === "downloading") {
      const percent = (state.loaded / state.total) * 100
      console.log(`${state.filename}: ${percent.toFixed(2)}%`)
    }
  }
})
```

这使得 CLI 模式和 TUI 模式可以共用相同的核心逻辑。

### 6.2 智能资源匹配

支持两种匹配模式：

```typescript
// 1. 关键词数组 - 灵活匹配
{ name: ["linux", "x64"] }
// 匹配: bun-linux-x64.zip, bun-linux-x64-baseline.zip 等

// 2. 精确名称 - 确定性匹配
{ name: "bun-linux-x64.zip" }
// 精确匹配: bun-linux-x64.zip
```

### 6.3 插件的函数式组合

插件之间通过 `context` 共享状态，但彼此独立：

```typescript
plugins: [
  unzip(),  // context.downloadedFilePath = "xxx.zip"
            // 解压后文件在 context.downloadDirname 中

  copy({    // 从 context.downloadDirname 搜索文件
    sourcePath: "bun",
    targetPath: "./bin/bun"
  }),

  clear()   // 清理 context.downloadedFilePath
]
```

### 6.4 生命周期钩子

提供细粒度的扩展点：

```typescript
hooks: {
  onTagFetched: async (tag) => {
    // 更新本地版本记录
    await fs.writeFile(".version", tag)
  },

  onAssetDownloadComplete: async (asset) => {
    // 发送下载完成通知
    await sendNotification(`Downloaded ${asset.fileName}`)
  },

  getAssetCache: async (asset) => {
    // 从数据库读取 ETag
    return db.get(asset.fileName)
  },

  setAssetCache: async (asset, cache) => {
    // 保存 ETag 到数据库
    await db.set(asset.fileName, cache.etag)
  }
}
```

### 6.5 代理模板系统

灵活的代理配置：

```typescript
// 1. 字符串模板
proxyUrl: "https://ghfast.top/{{href}}"
// {{href}} → 完整 URL
// {{host}} → github.com
// {{pathname}} → /repos/.../releases/...

// 2. 函数
proxyUrl: (originUrl) => {
  if (isChina()) return `https://ghfast.top/${originUrl}`
  return originUrl
}
```

### 6.6 Windows 兼容性

特别处理 Windows 上的 `wget` 别名问题：

```typescript
// PowerShell 中 wget 是 Invoke-WebRequest 的别名
// 自动检测并切换为 PowerShell 的下载命令
if (isWindowsWgetAlias) {
  commandTemplate = [
    "powershell.exe", "-Command", "Start-BitsTransfer",
    "-Source", "$DOWNLOAD_URL",
    "-Destination", "$DOWNLOAD_FILE"
  ]
}
```

---

## 七、未来展望

### 7.1 短期规划

1. **支持更多版本源**
   - GitLab Release
   - Gitea Release
   - 自建文件服务器

2. **增强插件生态**
   - `chmod` - 修改文件权限
   - `validate` - 自定义验证逻辑
   - `notify` - 下载完成通知

3. **改进 TUI**
   - 多任务并行显示
   - 更丰富的状态可视化

### 7.2 长期愿景

1. **跨语言支持**
   - 提供 Python/Go/Rust 版本
   - 或提供 HTTP API 服务

2. **企业级特性**
   - 私有仓库支持（GitHub Token）
   - 镜像源管理
   - 审计日志

3. **工具链集成**
   - Homebrew 集成
   - Docker 镜像
   - GitHub Action

---

## 八、总结

Grab SDK 从"自动化下载 GitHub Release 资源"这一痛点出发，基于**声明式配置、关注点分离、可扩展性优先**的设计哲学，构建了一个**轻量、可靠、灵活**的下载工具。

### 核心价值

1. **简化操作** - 从手动下载 → 一行配置
2. **提高可靠性** - 断点续传 + 哈希验证
3. **增强自动化** - 插件系统 + 生命周期钩子
4. **适应多场景** - 多下载模式 + 代理支持

### 技术特色

1. **状态机模型** - 清晰的状态转换和错误处理
2. **函数式插件** - 组合式后处理流程
3. **接口抽象** - Provider/Plugin/Hooks 可扩展
4. **类型安全** - 完整的 TypeScript 类型定义

### 哲学内核

**"让正确的事情变得简单，让复杂的事情成为可能"** - Grab SDK 提供了合理的默认值和简单的 API，同时保留了完全的可扩展性和控制能力。

---

**文档版本**: v1.0.0
**最后更新**: 2025-10-29
**维护者**: Gaubee ([@gaubee](https://github.com/gaubee))
