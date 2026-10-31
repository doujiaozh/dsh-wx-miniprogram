/**
 * DSH 插件清单适配层。
 *
 * 本项目以「CLI + 编程 API」为一等公民，同时提供 MCP 风格的工具描述，
 * 便于把四个能力（mp_init / mp_ui_kit / mp_gen / mp_browser_preview）
 * 注册为 DeepSeek Harness（或任意 MCP 宿主）可调用的工具。
 *
 * 约定：DSH_PLUGINS 描述"有哪些工具"，dshHandle 负责"分发调用"。
 */

import { scaffoldProject, ScaffoldOptions, ScaffoldResult } from '../mp_init';
import { injectUiKit } from '../mp_ui_kit';
import { generatePages, GenerateOptions, GenerateResult } from '../mp_gen';
import { buildPreview, PreviewOptions, PreviewResult } from '../mp_browser_preview';

export const DSH_PLUGIN_VERSION = '1.0.0';

export interface DshInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface DshTool {
  /** 工具名，全局唯一，调用时使用 */
  name: string;
  /** 工具描述（给大模型的语义说明） */
  description: string;
  /** 输入 JSON Schema */
  inputSchema: DshInputSchema;
}

export interface DshPluginManifest {
  manifestVersion: 1;
  /** 插件 id，kebab-case */
  id: string;
  /** 展示名 */
  name: string;
  version: string;
  description: string;
  tools: DshTool[];
}

export const DSH_PLUGINS: DshPluginManifest[] = [
  {
    manifestVersion: 1,
    id: 'mp-init',
    name: 'mp_init 极速项目脚手架',
    version: DSH_PLUGIN_VERSION,
    description: '一键生成微信小程序标准目录结构（app.json/js/wxss、页面四件套、TabBar、request 封装），不依赖本地编译与微信开发者工具 CLI。',
    tools: [
      {
        name: 'mp_init',
        description: '生成微信小程序项目骨架。输入项目名与可选标题/主题/输出目录，返回项目根路径与文件清单。',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: { type: 'string', description: '项目名/目录名，默认 mp-demo' },
            appTitle: { type: 'string', description: '首页导航栏标题，默认「首页」' },
            outputRoot: { type: 'string', description: '输出父目录，默认当前工作目录' },
            tabBar: {
              type: 'array',
              description: '自定义底部 TabBar；留空使用默认四 Tab（首页/分类/购物车/我的）；传空数组表示不要 TabBar',
              items: { type: 'object' },
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
    ],
  },
  {
    manifestVersion: 1,
    id: 'mp-ui-kit',
    name: 'mp_ui_kit 内置轻量级 UI 组件库',
    version: DSH_PLUGIN_VERSION,
    description: '一套纯原生 WXML/WXSS 的微信小程序组件（商品卡片、轮播图、导航格、悬浮按钮、骨架屏），通过文件拷贝注入目标项目，绕过 npm 安装。',
    tools: [
      {
        name: 'mp_ui_kit',
        description: '向已有小程序项目注入 UI 组件（components/<名>/index.*），返回写入文件与 usingComponents 映射。',
        inputSchema: {
          type: 'object',
          properties: {
            projectRoot: { type: 'string', description: '小程序项目根目录（绝对路径）' },
            components: {
              type: 'array',
              items: { type: 'string' },
              description: '只注入这些组件（product-card / swiper-banner / grid-nav / fab-button / skeleton）；留空注入全部',
            },
          },
          required: ['projectRoot'],
          additionalProperties: false,
        },
      },
    ],
  },
  {
    manifestVersion: 1,
    id: 'mp-gen',
    name: 'mp_gen 自然语言生成页面',
    version: DSH_PLUGIN_VERSION,
    description: '接收自然语言页面需求，调用大模型（默认 DeepSeek，优先额度充足的模型）输出严格 JSON，再用内置模板引擎批量生成 WXML/WXSS/JS/JSON 四件套并回写 app.json。',
    tools: [
      {
        name: 'mp_gen',
        description: '根据需求描述在小程序项目内生成页面。可传 demo=true 使用内置演示需求（不消耗 API 额度）。',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: '自然语言需求，如「带商品列表和购物车按钮的商城首页」' },
            projectRoot: { type: 'string', description: '小程序项目根目录（绝对路径）' },
            demo: { type: 'boolean', description: '跳过大模型，使用内置演示需求' },
            apiKey: { type: 'string', description: 'LLM API Key；默认读环境变量 DEEPSEEK_API_KEY / OPENAI_API_KEY / MP_LLM_API_KEY' },
            baseUrl: { type: 'string', description: 'LLM 服务地址，默认 https://api.deepseek.com' },
            model: { type: 'string', description: '模型名，默认 deepseek-chat' },
            injectUi: { type: 'boolean', description: '是否自动注入用到的 UI 组件，默认 true' },
          },
          required: ['prompt', 'projectRoot'],
          additionalProperties: false,
        },
      },
    ],
  },
  {
    manifestVersion: 1,
    id: 'mp-browser-preview',
    name: 'mp_browser_preview 浏览器伪预览',
    version: DSH_PLUGIN_VERSION,
    description: '把生成的 WXML/WXSS 转换为纯 HTML/CSS，输出带手机外壳的静态预览页（可选启动本地静态服务），在 Chrome 里即时看到大致效果，无需微信开发者工具。',
    tools: [
      {
        name: 'mp_browser_preview',
        description: '为小程序项目生成浏览器伪预览，返回预览入口 HTML 路径与文件清单。',
        inputSchema: {
          type: 'object',
          properties: {
            projectRoot: { type: 'string', description: '小程序项目根目录（绝对路径）' },
            outDir: { type: 'string', description: '预览输出目录，默认 <项目>/preview' },
            serve: { type: 'boolean', description: '是否同时返回本地服务地址' },
            port: { type: 'number', description: '本地服务端口，默认 3456' },
          },
          required: ['projectRoot'],
          additionalProperties: false,
        },
      },
    ],
  },
];

/**
 * DSH 工具分发器：按插件 id + 工具名执行只读/生成操作。
 * 所有工具的输出都是 JSON 可序列化对象。
 */
export async function dshHandle(pluginId: string, tool: string, input: any): Promise<unknown> {
  if (tool === 'mp_init' && pluginId === 'mp-init') {
    const opts = (input || {}) as ScaffoldOptions;
    const res: ScaffoldResult = scaffoldProject(opts);
    return { projectRoot: res.projectRoot, fileCount: res.files.length, files: res.files.map((f) => f.path) };
  }
  if (tool === 'mp_ui_kit' && pluginId === 'mp-ui-kit') {
    const i = (input || {}) as { projectRoot: string; components?: string[] };
    return injectUiKit(i.projectRoot, i.components);
  }
  if (tool === 'mp_gen' && pluginId === 'mp-gen') {
    const i = (input || {}) as GenerateOptions;
    const res: GenerateResult = await generatePages(i);
    return {
      pages: res.pages.map((p) => ({ name: p.name, files: p.files.map((f) => f.path), usingComponents: p.usingComponents })),
      warnings: res.warnings,
      model: res.model,
    };
  }
  if (tool === 'mp_browser_preview' && pluginId === 'mp-browser-preview') {
    const i = (input || {}) as PreviewOptions & { serve?: boolean; port?: number };
    const res: PreviewResult = buildPreview(i);
    return {
      outDir: res.outDir,
      indexHtml: res.indexHtml,
      htmlFiles: res.htmlFiles,
      ...(i.serve ? { url: `http://127.0.0.1:${i.port || 3456}/` } : {}),
    };
  }
  throw new Error(`未知的 DSH 工具：${pluginId} / ${tool}`);
}
