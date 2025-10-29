# Grab

一个声明式、CLI 优先的工具，用于从 GitHub Releases 下载和处理资源。

[English](README.md) | 简体中文

## 快速开始

### 零配置使用

使用一条命令即可为当前平台下载资源：

```bash
# 自动检测平台和架构
npx @gaubee/grab oven-sh/bun

# 下载并解压到指定位置
npx @gaubee/grab oven-sh/bun --output ./bin/bun --extract

# 为特定平台下载
npx @gaubee/grab oven-sh/bun --platform linux --arch x64 -o ./bin/bun --extract
```

### 使用配置文件

创建 `grab.config.ts` 用于重复下载或高级功能：

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

然后只需运行：

```bash
npx @gaubee/grab
```

## 功能特性

✅ **零配置** - 开箱即用，智能默认值
✅ **CLI 优先** - 无需配置文件即可使用全部功能
✅ **智能匹配** - 自动检测平台和架构
✅ **内置解压** - 支持 .zip、.tar.gz、.tgz
✅ **多种模式** - 使用 fetch、wget 或 curl 下载
✅ **代理支持** - 内置 GitHub 镜像支持
✅ **可恢复下载** - 使用 Range 请求自动恢复
✅ **哈希验证** - 使用 GitHub digest 进行完整性检查
✅ **交互式 TUI** - 可选的终端界面，带进度跟踪
✅ **子命令丰富** - list、init、cache、validate 等实用命令

## 安装

```bash
npm install -g @gaubee/grab
```

或直接使用 npx：

```bash
npx @gaubee/grab <repo>
```

## 命令行使用

### 基础示例

```bash
# 为当前平台下载 bun
grab oven-sh/bun

# 为 Linux x64 下载 deno 到指定位置
grab denoland/deno --platform linux --arch x64 -o ./bin/deno

# 下载并自动解压
grab oven-sh/bun --extract

# 下载、解压并清理压缩包
grab oven-sh/bun --extract --cleanup -o ./bin/bun

# 下载特定版本
grab oven-sh/bun --tag v1.0.30

# 通过精确文件名匹配
grab oven-sh/bun --name "bun-linux-x64-baseline.zip"
```

### 主命令参数

```
grab [repo] [options]

位置参数:
  repo              GitHub 仓库 (owner/repo)                        [字符串]

平台与架构:
  -p, --platform    平台 (linux, darwin, windows)                 [字符串]
  -a, --arch        架构 (x64, arm64, x86, arm)                   [字符串]

输出选项:
  -o, --output      下载文件的输出路径                              [字符串]
  -e, --extract     自动解压压缩包                                  [布尔值]
  -c, --cleanup     解压后删除压缩包                                [布尔值]

匹配选项:
  -n, --name        精确文件名或匹配模式                            [字符串]

版本选项:
  -t, --tag         要下载的 release 标签            [默认值: "latest"]

界面选项:
  -i, --interactive 启用交互式 TUI 模式                            [布尔值]
  -v, --verbose     显示详细输出                                   [布尔值]
  -q, --quiet       除错误外不显示任何输出                          [布尔值]

下载选项:
  -m, --mode        下载模式 (fetch, wget, curl)    [默认值: "fetch"]
  -s, --skip-download 跳过实际下载（用于测试）                     [布尔值]
  --use-proxy       启用下载代理                                   [布尔值]
  --proxy-url       代理 URL 模板                                  [字符串]

帮助与版本:
  -h, --help        显示帮助                                       [布尔值]
  -V, --version     显示版本号                                     [布尔值]
```

## 子命令

### `grab list` - 列出可用资源

列出指定 GitHub Release 的所有可用资源：

```bash
# 列出最新版本的资源
grab list oven-sh/bun

# 列出特定版本
grab list oven-sh/bun --tag v1.0.30

# JSON 格式输出
grab list oven-sh/bun --json

# 显示详细信息（下载次数、URL、发布说明）
grab list oven-sh/bun --verbose
```

**选项：**
- `-t, --tag` - 指定 release 标签（默认：latest）
- `--json` - 以 JSON 格式输出
- `-v, --verbose` - 显示详细信息

### `grab init` - 初始化配置文件

交互式创建 `grab.config.ts` 配置文件：

```bash
# 交互式创建配置
grab init

# 使用特定模板
grab init --template simple    # 单资源下载（推荐）
grab init --template multi     # 多资源下载
grab init --template advanced  # 包含 hooks 和插件

# 强制覆盖已有配置
grab init --force
```

**选项：**
- `--template` - 模板类型（simple/multi/advanced）
- `-f, --force` - 强制覆盖已有配置文件
- `-i, --interactive` - 交互式模式（默认）

### `grab cache` - 缓存管理

管理下载缓存：

```bash
# 查看缓存状态
grab cache
grab cache --status

# 列出所有缓存项
grab cache --list

# 清理超过 30 天的缓存
grab cache --clean

# 自定义清理天数
grab cache --clean --max-age 7

# 清空所有缓存
grab cache --clear

# 预览操作（不实际删除）
grab cache --clean --dry-run
```

**选项：**
- `--status` - 显示缓存状态（默认）
- `-l, --list` - 列出所有缓存项
- `--clean` - 清理旧缓存
- `--clear` - 清空所有缓存
- `--dry-run` - 预览操作
- `--max-age` - 清理天数阈值（默认：30）

### `grab validate` - 验证配置

验证 `grab.config.ts` 配置文件的正确性：

```bash
# 验证默认配置文件
grab validate

# 验证指定配置文件
grab validate grab.config.ts

# 显示详细信息
grab validate --verbose
```

**功能：**
- ✅ 验证配置文件语法和结构
- ✅ 检查必填字段
- ✅ 验证 repo 格式
- ✅ 验证平台和架构值
- ✅ 检测配置冲突并给出警告
- ✅ 详细的错误位置提示

## 配置文件

### 简单模式（推荐）

对于单资源下载，使用简化配置：

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

### 高级模式

对于多资源或自定义插件：

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
      console.log(`正在下载版本: ${tag}`);
    },
    onAssetDownloadComplete: async (asset) => {
      console.log(`已下载: ${asset.fileName}`);
    }
  },

  // 全局选项
  concurrency: 4,
  maxRetries: 3,
  useProxy: true,
  proxyUrl: "https://ghfast.top/{{href}}"
}
```

## 平台检测

Grab 自动检测您的平台和架构，理解各种命名约定：

**平台别名：**
- `linux`
- `darwin`、`macos`、`osx`、`mac` → darwin
- `windows`、`win32`、`win` → windows

**架构别名：**
- `x64`、`x86_64`、`amd64`、`x86-64` → x64
- `arm64`、`aarch64` → arm64
- `x86`、`i386`、`i686`、`386` → x86
- `arm`、`armv7`、`armv7l` → arm

## 智能资源匹配

Grab 根据您的条件智能匹配资源：

```bash
# 以下所有命令都适用于 Linux x64：
# - bun-linux-x64.zip
# - bun-x86_64-linux.zip
# - bun-amd64-linux.zip
grab oven-sh/bun --platform linux --arch x64
```

如果找不到匹配项，Grab 会显示建议：

```
未找到匹配的资源。

尝试匹配:
  - 平台: linux
  - 架构: x64

可用资源 (12):
    1. bun-darwin-aarch64.zip
    2. bun-darwin-x64.zip
    3. bun-linux-aarch64.zip
    4. bun-linux-x64.zip          ← 您是否指这个？
    5. bun-linux-x64-baseline.zip
    ...
```

## 交互模式

启动交互式 TUI 进行引导式下载：

```bash
grab oven-sh/bun --interactive
```

功能：
- 实时进度跟踪
- 多个并发下载
- 失败时重试
- 哈希验证，需要用户确认

## 代理支持

在某些地区使用 GitHub 镜像加速下载：

```bash
# 使用默认代理
grab oven-sh/bun --use-proxy

# 自定义代理 URL
grab oven-sh/bun --proxy-url "https://ghproxy.com/{{href}}"

# 在配置文件中
export default {
  repo: "oven-sh/bun",
  useProxy: true,
  proxyUrl: "https://ghfast.top/{{href}}"
}
```

## 下载模式

选择不同的下载方法：

```bash
# 默认: Node.js fetch（内置）
grab oven-sh/bun

# 使用 wget
grab oven-sh/bun --mode wget

# 使用 curl
grab oven-sh/bun --mode curl

# 自定义命令
grab oven-sh/bun --mode "aria2c -x 16 -o $DOWNLOAD_FILE $DOWNLOAD_URL"
```

## 插件

创建自定义后处理插件：

```typescript
import type { AssetPlugin } from '@gaubee/grab';

const customPlugin: AssetPlugin = async (context) => {
  const { downloadedFilePath, fileName, tag } = context;

  // 您的自定义逻辑
  console.log(`正在处理 ${fileName}，版本 ${tag}`);
};

export default {
  assets: [{
    repo: "oven-sh/bun",
    name: ["linux", "x64"],
    plugins: [customPlugin]
  }]
}
```

## 常见问题

### 哈希验证失败

```bash
# 清除缓存并重试
grab cache --clear
grab oven-sh/bun

# 或禁用代理（如果已启用）
grab oven-sh/bun --use-proxy false
```

### 平台未检测到

```bash
# 手动指定平台和架构
grab oven-sh/bun --platform linux --arch x64
```

### 没有匹配的资源

```bash
# 列出所有可用资源
grab list oven-sh/bun

# 使用精确文件名
grab oven-sh/bun --name "bun-linux-x64.zip"
```

### 查看缓存占用

```bash
# 查看缓存状态
grab cache --status

# 列出所有缓存项
grab cache --list
```

## 使用示例

### 下载 bun

```bash
# 最简单的形式
grab oven-sh/bun

# 带解压和清理
grab oven-sh/bun --extract --cleanup -o ./bin/bun
```

### 下载 deno

```bash
grab denoland/deno -p linux -a x64 --extract -o ./bin/deno
```

### 下载 Node.js

```bash
grab nodejs/node -p linux -a x64 --extract --cleanup -o ./bin/node
```

### 下载多个工具

创建 `grab.config.ts`：

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

然后运行：

```bash
grab
```

## 作为库使用

在您的 Node.js 项目中作为库使用：

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

## 环境变量

```bash
# 设置缓存目录
GRAB_CACHE_DIR=~/.cache/grab

# 设置 GitHub Token（用于提高 API 限制）
GRAB_GITHUB_TOKEN=ghp_xxxx

# 设置默认代理
GRAB_PROXY_URL=https://ghfast.top/{{href}}

# 设置默认平台和架构
GRAB_PLATFORM=linux
GRAB_ARCH=x64
```

## 贡献

欢迎贡献！请先阅读我们的[贡献指南](CONTRIBUTING.md)。

### 开发

```bash
# 克隆仓库
git clone https://github.com/gaubee/grab-sdk.git
cd grab-sdk

# 安装依赖
pnpm install

# 运行测试
pnpm test

# 构建
pnpm build

# 本地测试 CLI
tsx src/cli.ts oven-sh/bun --platform linux --arch x64
```

## 许可证

MIT © [Gaubee](https://github.com/gaubee)

## 致谢

- 灵感来源于 CI/CD 工作流中的常见痛点
- 使用 TypeScript 构建以确保类型安全
- 使用 [unconfig](https://github.com/antfu/unconfig) 实现灵活的配置

## 相关项目

- [download-github-release](https://github.com/robinvdvleuten/node-download-github-release) - 替代工具
- [get-release](https://github.com/tauri-apps/tauri/tree/dev/tooling/cli/node) - Tauri 的方案

---

**如果觉得有用，请给这个仓库点个 Star！** ⭐
