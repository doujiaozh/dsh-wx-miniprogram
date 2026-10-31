/**
 * mp_browser_preview —— 浏览器伪预览。
 *
 * 把小程序项目的 WXML/WXSS 转成纯 HTML/CSS：
 *   - 每个页面一个 <name>.html（含换算后的样式与 data 渲染结果）
 *   - 附加 index.html：手机外壳 + 页面切换 Tab，直接用 Chrome 打开即可
 *   - 可选 servePreview：起一个本地静态服务，便于远端/无文件权限场景访问
 */

import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { exists, readJson, writeJson } from '../core/fs';
import { wxmlToHtml, wxssToCss, extractPageData, PREVIEW_EXTRA_CSS } from './converter';

/** 预览选项 */
export interface PreviewOptions {
  /** 小程序项目根目录 */
  projectRoot: string;
  /** 预览输出目录，默认 <项目>/preview */
  outDir?: string;
}

/** 预览结果 */
export interface PreviewResult {
  /** 预览输出目录（绝对路径） */
  outDir: string;
  /** 预览入口 index.html（绝对路径） */
  indexHtml: string;
  /** 全部 HTML 文件（绝对路径） */
  htmlFiles: string[];
}

interface PageInfo {
  /** 页面名，如 index */
  name: string;
  /** app.json 中的页面路径，如 pages/index/index */
  path: string;
  /** html 文件名，如 index.html */
  html: string;
  /** 导航栏标题 */
  title: string;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * 为小程序项目生成浏览器伪预览。
 */
export function buildPreview(opts: PreviewOptions): PreviewResult {
  if (!opts || !opts.projectRoot) throw new Error('buildPreview 需要 projectRoot');
  const root = path.resolve(opts.projectRoot);
  const appJsonPath = path.join(root, 'app.json');
  if (!exists(appJsonPath)) {
    throw new Error(`在 ${root} 找不到 app.json：请先用 mp init 生成项目骨架。`);
  }
  const outDir = path.resolve(opts.outDir || path.join(root, 'preview'));

  const app = readJson<Record<string, any>>(appJsonPath);
  const pages: string[] = Array.isArray(app.pages) ? app.pages : [];
  if (!pages.length) throw new Error('app.json 中没有 pages，无法生成预览');

  // 全局样式（app.wxss）
  const appWxssPath = path.join(root, 'app.wxss');
  const appCss = exists(appWxssPath) ? wxssToCss(fs.readFileSync(appWxssPath, 'utf8')) : '';

  fs.mkdirSync(outDir, { recursive: true });
  // 页面 HTML 放进 pages/ 子目录，避免与入口 index.html 同名覆盖
  const pagesDir = path.join(outDir, 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });

  const infos: PageInfo[] = [];
  for (const p of pages) {
    const name = path.basename(p);
    const wxmlPath = path.join(root, `${p}.wxml`);
    if (!exists(wxmlPath)) continue; // 跳过缺四件套的页面
    const wxssPath = path.join(root, `${p}.wxss`);
    const jsPath = path.join(root, `${p}.js`);
    const jsonPath = path.join(root, `${p}.json`);

    const wxml = fs.readFileSync(wxmlPath, 'utf8');
    const wxss = exists(wxssPath) ? wxssToCss(fs.readFileSync(wxssPath, 'utf8')) : '';
    const js = exists(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';
    const data = extractPageData(js);
    let title = name;
    if (exists(jsonPath)) {
      try {
        title = (readJson<Record<string, any>>(jsonPath).navigationBarTitleText as string) || title;
      } catch {
        /* 忽略损坏的页面 json */
      }
    }

    const bodyHtml = wxmlToHtml(wxml, data);
    const html = pageDocument(title, appCss + '\n' + wxss, bodyHtml);
    const htmlFile = `pages/${name}.html`;
    fs.writeFileSync(path.join(outDir, htmlFile), html, 'utf8');
    infos.push({ name, path: p, html: htmlFile, title });
  }

  if (!infos.length) throw new Error(`项目 ${pages.join('、')} 均缺少 WXML 文件，无法生成预览`);

  const indexHtml = path.join(outDir, 'index.html');
  fs.writeFileSync(indexHtml, indexDocument(infos), 'utf8');

  return {
    outDir,
    indexHtml,
    htmlFiles: [indexHtml, ...infos.map((i) => path.join(outDir, i.html))],
  };
}

/** 单页面文档 */
function pageDocument(title: string, css: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { width: 375px; min-height: 667px; margin: 0 auto; background: #f5f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif; font-size: 14px; color: #1a1a1a; }
${PREVIEW_EXTRA_CSS}
${css}
  </style>
</head>
<body>
${body}
</body>
</html>
`;
}

/** 预览入口：手机外壳 + 页面切换 */
function indexDocument(infos: PageInfo[]): string {
  const tabs = infos
    .map(
      (i, idx) =>
        `<div class="tab ${idx === 0 ? 'on' : ''}" data-target="${i.html}"><span>${escapeHtml(i.title)}</span></div>`,
    )
    .join('\n');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>伪预览 · 微信小程序</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #1d1f24; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 32px 0; }
    .title { font-size: 18px; letter-spacing: 1px; margin-bottom: 24px; opacity: .85; }
    .phone { width: 375px; height: 667px; border-radius: 36px; background: #000; padding: 10px; box-shadow: 0 24px 80px rgba(0,0,0,.55); position: relative; }
    .phone::before { content: ''; position: absolute; left: 50%; top: 16px; transform: translateX(-50%); width: 110px; height: 6px; border-radius: 999px; background: #333; z-index: 2; }
    .screen { width: 100%; height: 100%; border-radius: 28px; overflow: hidden; background: #f5f6f8; }
    .screen iframe { width: 100%; height: 100%; border: 0; display: block; }
    .tabs { display: flex; gap: 8px; margin-top: 24px; flex-wrap: wrap; justify-content: center; max-width: 420px; }
    .tab { padding: 8px 16px; border-radius: 999px; background: #2b2e35; font-size: 13px; cursor: pointer; opacity: .7; transition: all .15s; }
    .tab:hover { opacity: 1; }
    .tab.on { background: #07C160; opacity: 1; }
    .hint { margin-top: 18px; font-size: 12px; opacity: .45; text-align: center; }
  </style>
</head>
<body>
  <div class="title">微信小程序 · 浏览器伪预览</div>
  <div class="phone">
    <div class="screen"><iframe id="frame" src="${infos[0].html}"></iframe></div>
  </div>
  <div class="tabs">
${tabs}
  </div>
  <div class="hint">静态预览，仅供查看布局与视觉；真实效果请导入微信开发者工具</div>
  <script>
    var frame = document.getElementById('frame');
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        frame.src = t.getAttribute('data-target');
      });
    });
  </script>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 启动本地静态预览服务。
 * @param dir buildPreview 返回的 outDir
 * @param port 端口，默认 3456
 * @returns 服务句柄（url / close）
 */
export function servePreview(dir: string, port = 3456): { url: string; close: () => void } {
  if (!dir) throw new Error('servePreview 需要 outDir');
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let file = urlPath === '/' ? path.join(root, 'index.html') : path.join(root, urlPath);
      if (!exists(file)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(file).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      const data = fs.readFileSync(file);
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch (err) {
      res.writeHead(500);
      res.end(String((err as Error).message));
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${port}/`;
      resolve({ url, close: () => server.close() });
    });
  }) as unknown as { url: string; close: () => void };
}

/** 重新导出转换器，方便单独使用 */
export { wxmlToHtml, wxssToCss, rpxToPx, extractPageData } from './converter';
