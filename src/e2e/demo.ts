/**
 * 端到端冒烟测试：不消耗任何 LLM 额度（demo=true），走完全流程并校验产物。
 *
 * 运行：npm run demo
 */

import * as fs from 'fs';
import * as path from 'path';
import { scaffoldProject } from '../mp_init';
import { injectUiKit, listComponents } from '../mp_ui_kit';
import { generatePages } from '../mp_gen';
import { buildPreview } from '../mp_browser_preview';

const FOUR_PIECES = ['wxml', 'wxss', 'js', 'json'] as const;

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`✗ 断言失败：${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function main(): Promise<void> {
  const root = path.resolve(__dirname, '..', '..');
  const out = path.join(root, 'demo-output');
  if (fs.existsSync(out)) fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  console.log('\n[1/5] mp_init：生成脚手架');
  const scaffold = scaffoldProject({ projectName: 'mall-demo', appTitle: '极速商城', outputRoot: out });
  assert(fs.existsSync(path.join(scaffold.projectRoot, 'app.json')), 'app.json 存在');
  assert(fs.existsSync(path.join(scaffold.projectRoot, 'utils', 'request.js')), 'utils/request.js 存在');
  assert(fs.existsSync(path.join(scaffold.projectRoot, 'pages', 'index', 'index.wxml')), 'pages/index/index.wxml 存在');
  assert(fs.existsSync(path.join(scaffold.projectRoot, 'images', 'tab-normal.png')), 'TabBar 占位图标存在');

  console.log('\n[2/5] mp_ui_kit：注入组件库');
  const ui = injectUiKit(scaffold.projectRoot);
  assert(Object.keys(ui.usingComponents).length === listComponents().length, `全部 ${listComponents().length} 个组件已注入`);
  assert(fs.existsSync(path.join(scaffold.projectRoot, 'components', 'product-card', 'index.wxml')), 'product-card 组件存在');

  console.log('\n[3/5] mp_gen（demo 模式，不调大模型）：生成页面');
  const gen = await generatePages({ prompt: '商城首页演示', projectRoot: scaffold.projectRoot, demo: true });
  assert(gen.pages.length > 0, `生成 ${gen.pages.length} 个页面`);
  for (const page of gen.pages) {
    for (const ext of FOUR_PIECES) {
      assert(fs.existsSync(path.join(scaffold.projectRoot, 'pages', page.name, `${page.name}.${ext}`)), `pages/${page.name}/${page.name}.${ext} 存在`);
    }
  }
  const appJson = JSON.parse(fs.readFileSync(path.join(scaffold.projectRoot, 'app.json'), 'utf8'));
  assert(Array.isArray(appJson.pages) && appJson.pages.some((p: string) => p.startsWith(`pages/${gen.pages[0].name}`)), 'app.json.pages 已回写');
  assert(gen.warnings.length === 0, '无未知 section 警告（demo spec 全部命中）');

  console.log('\n[4/5] mp_browser_preview：生成伪预览');
  const preview = buildPreview({ projectRoot: scaffold.projectRoot });
  assert(fs.existsSync(preview.indexHtml), '预览入口 HTML 存在');
  assert(preview.htmlFiles.length > 0, `产出 ${preview.htmlFiles.length} 个 HTML 文件`);

  console.log('\n[5/5] 汇总');
  const allFiles = fs.readdirSync(scaffold.projectRoot, { recursive: true }).filter((f) => !fs.statSync(path.join(scaffold.projectRoot, String(f))).isDirectory());
  console.log(`  项目根目录：${scaffold.projectRoot}`);
  console.log(`  文件总数：${allFiles.length}`);
  console.log(`  内置组件：${listComponents().join('、')}`);
  console.log(`  预览入口：${preview.indexHtml}`);
  console.log('\n✅ 全部冒烟断言通过。用微信开发者工具导入上面的项目根目录即可运行。');
}

main().catch((err: Error) => {
  console.error(`✗ 冒烟测试失败：${err.stack || err.message}`);
  process.exit(1);
});
