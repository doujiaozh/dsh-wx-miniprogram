#!/usr/bin/env node
/**
 * mp —— 微信小程序 5 分钟生成器 CLI（DSH WeChat MiniProgram Generator）
 *
 * 命令：
 *   mp init  [选项]                       极速项目脚手架
 *   mp ui    [选项]                       注入轻量级 UI 组件库
 *   mp gen   "<需求描述>" [选项]          自然语言生成页面（调用大模型）
 *   mp preview [选项]                     生成浏览器伪预览（HTML/CSS）
 *   mp all   "<需求描述>" [选项]          一句话全流程：init + ui + gen + preview
 *
 * 通用约定：-p/--project 指向小程序项目根目录（默认当前目录）。
 */

import * as path from 'path';
import * as fs from 'fs';
import { scaffoldProject } from '../mp_init';
import { injectUiKit, listComponents } from '../mp_ui_kit';
import { generatePages } from '../mp_gen';
import { buildPreview, servePreview } from '../mp_browser_preview';

interface ParsedArgs {
  command: string;
  positional: string[];
  opts: Record<string, string | boolean>;
}

const HELP = `
mp —— 微信小程序 5 分钟生成器（DSH WeChat MiniProgram Generator）

用法：
  mp init [选项]                          极速项目脚手架
    -n, --name <名>                       项目名/目录名（默认 mp-demo）
    -t, --title <标题>                     首页导航栏标题（默认 首页）
    -o, --output <目录>                    输出父目录（默认当前目录）
    --no-tabbar                           不生成底部 TabBar

  mp ui [选项]                            注入内置 UI 组件库（文件拷贝，无 npm）
    -p, --project <目录>                  小程序项目根目录（默认当前目录）
    --only a,b                            只注入指定组件
    --list                                列出全部可用组件

  mp gen "<需求描述>" [选项]              自然语言生成页面
    -p, --project <目录>                  小程序项目根目录（默认当前目录）
    --demo                                不调大模型，使用内置演示需求
    --api-key <key>                       LLM API Key（默认读环境变量）
    --base-url <url>                      LLM 服务地址（默认 https://api.deepseek.com）
    --model <名>                          模型名（默认 deepseek-chat）
    --no-ui                               不自动注入用到的 UI 组件
    --no-json-update                      不回写 app.json

  mp preview [选项]                       浏览器伪预览（WXML/WXSS → HTML/CSS）
    -p, --project <目录>                  小程序项目根目录（默认当前目录）
    -o, --out <目录>                      预览输出目录（默认 <项目>/preview）
    --serve                               启动本地静态服务
    --port <端口>                         服务端口（默认 3456）

  mp all "<需求描述>" [选项]              一句话全流程
    -n, --name <名> -o, --output <目录>   同 init
    其余选项同 gen / preview

示例：
  # 一句话生成一个完整小程序
  mp all "帮我做一个带商品列表和购物车按钮的商城首页" -n my-mall

  # 分步执行
  mp init -n my-mall -t 极速商城
  mp ui -p my-mall
  mp gen "商城首页：轮播图 + 分类宫格 + 商品双列瀑布流 + 购物车悬浮按钮" -p my-mall
  mp preview -p my-mall --serve
`.trim();

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const opts: Record<string, string | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > -1) {
        opts[a.slice(2, eq)] = a.slice(eq + 1);
        i++;
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        opts[a.slice(2)] = next;
        i += 2;
        continue;
      }
      opts[a.slice(2)] = true;
      i++;
      continue;
    }
    if (a.startsWith('-') && a.length > 1) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        opts[a.slice(1)] = next;
        i += 2;
        continue;
      }
      opts[a.slice(1)] = true;
      i++;
      continue;
    }
    positional.push(a);
    i++;
  }
  return { command: positional[0] || '', positional: positional.slice(1), opts };
}

function str(v: string | boolean | undefined, def?: string): string | undefined {
  return typeof v === 'string' ? v : def;
}

function resolveProject(opts: Record<string, string | boolean>): string {
  const p = str(opts['p'] ?? opts['project'], '.') as string;
  return path.resolve(p);
}

function needProject(root: string): void {
  if (!fs.existsSync(path.join(root, 'app.json'))) {
    throw new Error(`在 ${root} 找不到 app.json：请先运行 mp init 生成项目，或用 -p 指向正确的项目根目录。`);
  }
}

async function main(): Promise<void> {
  const { command, positional, opts } = parseArgs(process.argv.slice(2));

  if (!command || command === 'help' || command === '--help' || (opts['h'] ?? opts['help'])) {
    console.log(HELP);
    return;
  }

  switch (command) {
    case 'init': {
      const res = scaffoldProject({
        projectName: str(opts['n'] ?? opts['name'], 'mp-demo') as string,
        appTitle: str(opts['t'] ?? opts['title']),
        tabBar: opts['no-tabbar'] ? [] : undefined,
        outputRoot: str(opts['o'] ?? opts['output'], process.cwd()) as string,
      });
      console.log(`✓ 项目脚手架已生成：${res.projectRoot}`);
      console.log(`  共写入 ${res.files.length} 个文件`);
      console.log('  下一步：mp ui -p <项目> 注入组件库，再 mp gen "你的需求" -p <项目>');
      return;
    }

    case 'ui': {
      if (opts['list']) {
        console.log('内置 UI 组件：\n  - ' + listComponents().join('\n  - '));
        return;
      }
      const root = resolveProject(opts);
      needProject(root);
      const only = String(str(opts['only'], '') as string)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = injectUiKit(root, only.length ? only : undefined);
      console.log(`✓ UI 组件库已注入 ${root}`);
      console.log(`  写入 ${res.written.length} 个文件，可用组件 ${Object.keys(res.usingComponents).length} 个`);
      return;
    }

    case 'gen': {
      const prompt = positional.join(' ').trim();
      if (!prompt) {
        throw new Error('请提供需求描述，例如：mp gen "带商品列表和购物车按钮的商城首页"');
      }
      const root = resolveProject(opts);
      needProject(root);
      const res = await generatePages({
        prompt,
        projectRoot: root,
        demo: Boolean(opts['demo']),
        apiKey: str(opts['api-key']),
        baseUrl: str(opts['base-url']),
        model: str(opts['model']),
        injectUi: !opts['no-ui'],
        updateAppJson: !opts['no-json-update'],
      });
      console.log(`✓ 已根据需求生成 ${res.pages.length} 个页面（项目：${root}）${res.model ? `，模型：${res.model}` : ''}`);
      for (const w of res.warnings) console.log(`  ! ${w}`);
      for (const p of res.pages) {
        console.log(`  - pages/${p.name}/${p.name}.*（${p.files.length} 个文件，${Object.keys(p.usingComponents).length} 个 UI 组件）`);
      }
      console.log('  下一步：mp preview -p <项目> 生成浏览器伪预览');
      return;
    }

    case 'preview': {
      const root = resolveProject(opts);
      needProject(root);
      const res = buildPreview({
        projectRoot: root,
        outDir: str(opts['o'] ?? opts['out']),
      });
      console.log(`✓ 浏览器伪预览已生成：${res.indexHtml}`);
      console.log(`  共 ${res.htmlFiles.length} 个 HTML 文件`);
      if (opts['serve']) {
        const port = Number(str(opts['port'], '3456'));
        const server = await servePreview(res.outDir, port);
        console.log(`  预览服务已启动：${server.url}（按 Ctrl+C 退出）`);
      } else {
        console.log('  提示：加 --serve 可直接启动本地预览服务');
      }
      return;
    }

    case 'all': {
      // --demo 时允许省略需求描述，使用内置演示需求
      const prompt = positional.join(' ').trim()
        || (opts['demo'] ? '（内置演示）带搜索栏、轮播图、金刚区、公告、商品双列列表和购物车悬浮按钮的推荐页' : '');
      if (!prompt) {
        throw new Error('请提供需求描述，例如：mp all "帮我做一个带商品列表和购物车按钮的商城首页" -n my-mall');
      }
      const name = str(opts['n'] ?? opts['name'], 'mp-demo') as string;
      const step1 = scaffoldProject({
        projectName: name,
        appTitle: str(opts['t'] ?? opts['title']),
        tabBar: opts['no-tabbar'] ? [] : undefined,
        outputRoot: str(opts['o'] ?? opts['output'], process.cwd()) as string,
      });
      console.log(`✓ [1/4] 项目脚手架：${step1.projectRoot}（${step1.files.length} 文件）`);

      const ui = injectUiKit(step1.projectRoot);
      console.log(`✓ [2/4] UI 组件库注入：${Object.keys(ui.usingComponents).length} 个组件`);

      const gen = await generatePages({
        prompt,
        projectRoot: step1.projectRoot,
        demo: Boolean(opts['demo']),
        apiKey: str(opts['api-key']),
        baseUrl: str(opts['base-url']),
        model: str(opts['model']),
      });
      console.log(`✓ [3/4] 自然语言生成：${gen.pages.length} 个页面${gen.model ? `（模型：${gen.model}）` : ''}`);
      for (const w of gen.warnings) console.log(`  ! ${w}`);

      const preview = buildPreview({ projectRoot: step1.projectRoot });
      console.log(`✓ [4/4] 浏览器伪预览：${preview.indexHtml}`);

      console.log('\n完成！两件事你可以立刻做：');
      console.log(`  1) 用浏览器打开伪预览：${preview.indexHtml}`);
      console.log(`  2) 打开「微信开发者工具」→ 导入项目 → 目录选 ${step1.projectRoot} → AppID 选「测试号」`);
      return;
    }

    default:
      throw new Error(`未知命令：${command}\n\n${HELP}`);
  }
}

main().catch((err: Error) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
