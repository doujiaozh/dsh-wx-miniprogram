# DSH WeChat MiniProgram 5-minute Generator

> 一句话，五分钟，生成一个结构完整、UI 精美、可直接导入微信开发者工具运行的微信小程序。

纯 **Node.js + TypeScript** 实现，**零运行时依赖**、**零本地编译**、**不调用微信开发者工具 CLI**——在 Windows 7 这样的老旧环境下也能稳定运行。通过文件系统直接生成 `WXML / WXSS / JS / JSON` 四件套。

## 快速开始

```powershell
git clone <你的仓库地址> dsh-wx-miniprogram
cd dsh-wx-miniprogram
npm install          # 仅安装 TypeScript 与 @types/node（开发依赖）
npm run build        # 编译到 dist/

# 一句话生成完整小程序
node dist/cli/index.js all "帮我做一个带商品列表和购物车按钮的商城首页" -n my-mall
```

完成后你会拿到两样东西：

1. **浏览器伪预览**：`my-mall/preview/index.html`，双击即可在 Chrome 里先睹为快。
2. **完整小程序工程**：`my-mall/`，直接导入微信开发者工具。

没有大模型 API Key？用内置演示需求先跑通全链路（不消耗任何额度）：

```powershell
node dist/cli/index.js all --demo -n my-mall
```

## 四个插件

| 插件 | 作用 |
| --- | --- |
| **mp_init** | 极速项目脚手架：`app.js / app.json / app.wxss`、四个页面四件套、底部 TabBar、顶部导航栏、`utils/request.js` 网络请求封装 |
| **mp_ui_kit** | 内置轻量 UI 组件库：商品卡片、轮播图、导航格（金刚区）、悬浮按钮、骨架屏。纯原生 `WXML/WXSS/JS`，通过文件拷贝注入，绕过 npm |
| **mp_gen** | 自然语言生成页面：调用大模型输出严格 JSON，本地确定性编译出 `WXML/WXSS/JS/JSON` |
| **mp_browser_preview** | 浏览器伪预览：把 `WXML/WXSS` 转换为 `HTML/CSS`（rpx→px、`wx:for`/`wx:if` 展开、组件内联），生成带手机外壳的静态预览页，可一键起本地静态服务 |

## 命令清单

```powershell
# 1) 脚手架（-n 项目名 -t 标题 --no-tabbar 不要 TabBar）
mp init -n my-mall -t 极速商城

# 2) 注入 UI 组件库（--list 查看可用组件）
mp ui -p my-mall --list
mp ui -p my-mall --only product-card,fab-button

# 3) 自然语言生成页面（--demo 免 Key，-p 项目目录）
mp gen "商城首页：轮播图 + 分类宫格 + 商品双列瀑布流 + 购物车悬浮按钮" -p my-mall

# 4) 浏览器伪预览（--serve 起本地静态服务，默认 3456 端口）
mp preview -p my-mall --serve

# 一句话全流程
mp all "帮我做一个带商品列表和购物车按钮的商城首页" -n my-mall
```

> `mp` 为 `npm link` 后的全局软链；未 link 时用 `node dist/cli/index.js` 代替。

## 大模型配置（mp_gen）

mp_gen 默认调用 DeepSeek API，按下列顺序读取 Key（任一即可）：

```powershell
# Windows PowerShell（当前会话）
$env:DEEPSEEK_API_KEY = "sk-xxxxxxxx"

# 或写入用户级环境变量（永久生效）
setx DEEPSEEK_API_KEY "sk-xxxxxxxx"
```

| 配置项 | 环境变量 | 默认值 |
| --- | --- | --- |
| API Key | `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` / `MP_LLM_API_KEY` | — |
| Base URL | `LLM_BASE_URL` | `https://api.deepseek.com` |
| 模型 | `LLM_MODEL` | `deepseek-chat` |

也可在命令行临时指定：`mp gen "需求" -p my-mall --api-key sk-xxx --base-url https://api.deepseek.com --model deepseek-chat`。

**为什么稳？** 大模型只负责输出严格 JSON（页面规格），四件套由本地模板引擎**确定性生成**——即使模型输出有微小瑕疵，也只会降低生成内容的丰富度，产物永远语法正确、可直接编译。

## 生成的项目结构

```
my-mall/
├── app.js                    # 入口：globalData、统一请求入口
├── app.json                  # 页面注册、窗口配置、TabBar
├── app.wxss                  # 全局样式
├── project.config.json       # appid 默认 touristappid（测试号）
├── sitemap.json
├── images/                   # TabBar 占位图标
├── utils/
│   └── request.js            # Promise 风格 wx.request 封装
├── components/               # mp_ui_kit 注入的组件
│   ├── product-card/
│   ├── swiper-banner/
│   ├── grid-nav/
│   ├── fab-button/
│   └── skeleton/
├── pages/
│   ├── index/                # 首页（轮播 + 金刚区 + 商品）
│   ├── category/             # 分类（侧边分类 + 商品）
│   ├── cart/                 # 购物车（勾选/步进器/合计）
│   ├── mine/                 # 我的（渐变头部 + 订单宫格）
│   └── recommend/            # mp_gen 生成的推荐页
└── preview/                  # 浏览器伪预览
    ├── index.html            # 入口（手机外壳 + 页面切换）
    └── pages/                # 各页面转换后的 HTML
```

## 导入微信开发者工具（标准步骤）

1. 打开微信开发者工具（稳定版即可），点击 **「+ 新建项目」** 或 **「导入项目」**。
2. **项目目录** 选择生成的 `my-mall\` 根目录（含 `app.json` 的那一层）。
3. **AppID** 点击下拉，选择 **「测试号」**（`project.config.json` 已默认填 `touristappid`）；若你有自己的 AppID，填入后会自动回写。
4. **项目名称** 随意，**模板** 选「不使用模板」（目录已自带完整结构）。
5. 点击 **「导入」**——编译完成后即可在模拟器中预览、真机调试。

> Windows 7 下微信开发者工具可能无响应？这正是本项目的价值：先用 `preview/index.html` 在 Chrome 里看个大概，再把工程拷到任意现代环境的机器上导入。

## 编程 API

```ts
import { scaffoldProject, injectUiKit, generatePages, buildPreview } from 'dsh-wx-miniprogram';

const root = scaffoldProject({ projectName: 'my-mall', appTitle: '极速商城' }).projectRoot;
injectUiKit(root);                                    // 注入全部 UI 组件
const { pages, warnings } = await generatePages({     // 自然语言 → 页面
  prompt: '带商品列表和购物车按钮的商城首页',
  projectRoot: root,
});
const { indexHtml } = buildPreview({ projectRoot: root });  // 浏览器伪预览
```

另有 `servePreview(dir, port)` 可启动本地静态服务（默认 `http://127.0.0.1:3456`）。

## DSH 插件清单适配

本项目提供 DeepSeek Harness 插件清单适配层（`src/dsh/plugins.ts`），四个插件以 MCP 风格工具暴露：

```ts
import { DSH_PLUGINS, dshHandle } from 'dsh-wx-miniprogram';
const result = await dshHandle('mp-init', 'mp_init', { projectName: 'my-mall' });
```

插件清单（`DSH_PLUGINS`）可直接嵌入 DSH 插件配置，实现「自然语言一句话 → 自动生成小程序」的 Agent 能力。

## 开发

```powershell
npm run build        # tsc 编译
npm run demo         # 端到端冒烟测试（demo 模式，不耗大模型额度）
npm run start        # demo 的别名
```

## LICENSE

MIT
