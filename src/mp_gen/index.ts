/**
 * mp_gen —— 自然语言生成页面：对外入口。
 *
 * 流程：需求描述 → 大模型输出严格 JSON（PageSpecV1）→ 本地确定性编译为四件套
 *      → 自动注入用到的 UI 组件 → 回写 app.json（pages / tabBar / window）
 */

import * as path from 'path';
import { FileSpec } from '../core/types';
import { writeFiles, readJson, writeJson, exists } from '../core/fs';
import { injectUiKit } from '../mp_ui_kit';
import { GenerateOptions, GenerateResult, GeneratedPage, GenResultV1, PageSpecV1 } from './types';
import { callLLM } from './llm';
import { SYSTEM_PROMPT, buildUserPrompt, extractJson } from './prompt';
import { DEMO_SPEC } from './demoSpec';
import { buildPage, isKnownSection, pageName } from './pageBuilder';

/** 从 Spec 中提取警告（未知 section / 空页面） */
function collectWarnings(spec: GenResultV1): string[] {
  const warnings: string[] = [];
  if (!Array.isArray(spec.pages) || spec.pages.length === 0) {
    warnings.push('spec 中没有页面');
    return warnings;
  }
  spec.pages.forEach((p: PageSpecV1, pi: number) => {
    const sections = Array.isArray(p.sections) ? p.sections : [];
    if (sections.length === 0) warnings.push(`页面 #${pi + 1}（${p.name}）没有任何 section`);
    sections.forEach((s: any, si: number) => {
      if (!isKnownSection(s)) warnings.push(`页面 ${p.name} 的第 ${si + 1} 个 section 类型「${s && s.type}」未知，已跳过`);
    });
  });
  return warnings;
}

/** 回写 app.json：追加新页面、保留已有配置 */
function updateAppJson(projectRoot: string, names: string[]): void {
  const appJsonPath = path.join(projectRoot, 'app.json');
  if (!exists(appJsonPath)) return; // 兜底：没有 app.json 就跳过
  const app = readJson<Record<string, any>>(appJsonPath);
  const pages: string[] = Array.isArray(app.pages) ? app.pages.slice() : [];
  for (const n of names) {
    const p = `pages/${n}/${n}`;
    if (!pages.includes(p)) pages.push(p);
  }
  app.pages = pages;
  writeJson(appJsonPath, app);
}

/**
 * 根据自然语言需求在小程序项目内生成页面。
 *
 * @example
 *   await generatePages({
 *     prompt: '带商品列表和购物车按钮的商城首页',
 *     projectRoot: 'D:/code/my-mall',
 *   });
 */
export async function generatePages(opts: GenerateOptions): Promise<GenerateResult> {
  if (!opts || !opts.projectRoot) throw new Error('generatePages 需要 projectRoot');
  if (!opts.demo && !(opts.prompt && opts.prompt.trim())) {
    throw new Error('generatePages 需要 prompt（需求描述），或传 demo=true 使用演示需求');
  }

  const root = path.resolve(opts.projectRoot);
  if (!exists(path.join(root, 'app.json'))) {
    throw new Error(`在 ${root} 找不到 app.json：请先用 mp init / scaffoldProject 生成项目骨架。`);
  }

  // 1. 取 spec
  let spec: GenResultV1;
  let model: string | undefined;
  if (opts.demo) {
    spec = DEMO_SPEC;
  } else {
    const res = await callLLM(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(opts.prompt) },
      ],
      { apiKey: opts.apiKey, baseUrl: opts.baseUrl, model: opts.model },
    );
    model = res.model;
    spec = extractJson(res.content);
  }

  const warnings = collectWarnings(spec);
  const pages: PageSpecV1[] = Array.isArray(spec.pages) ? spec.pages.slice(0, 10) : [];
  if (pages.length === 0) {
    throw new Error('生成失败：spec 中没有可用页面（' + warnings.join('；') + '）');
  }

  // 2. 逐页构建
  const generated: GeneratedPage[] = pages.map((p) => buildPage(p));
  const names = generated.map((g) => g.name);

  // 3. 注入用到的 UI 组件（先收集再一次性注入，避免重复写盘）
  if (opts.injectUi !== false) {
    const need: string[] = [];
    for (const g of generated) {
      for (const c of Object.keys(g.usingComponents)) if (!need.includes(c)) need.push(c);
    }
    if (need.length) injectUiKit(root, need);
  }

  // 4. 落盘四件套（buildPage 只产生 FileSpec，不写盘）
  const allFiles: FileSpec[] = [];
  for (const g of generated) allFiles.push(...g.files);
  writeFiles(root, allFiles);

  // 5. 回写 app.json
  if (opts.updateAppJson !== false) updateAppJson(root, names);

  // 6. 校验落盘（仅校验文本四件套）
  const missing: string[] = [];
  for (const g of generated) {
    for (const ext of ['wxml', 'wxss', 'js', 'json']) {
      if (!exists(path.join(root, 'pages', g.name, `${g.name}.${ext}`))) {
        missing.push(`pages/${g.name}/${g.name}.${ext}`);
      }
    }
  }
  if (missing.length) warnings.push(`部分文件落盘失败：${missing.join('、')}`);

  return { pages: generated, warnings, model };
}

export { pageName, buildPage } from './pageBuilder';
export { DEMO_SPEC } from './demoSpec';
export { SYSTEM_PROMPT, buildUserPrompt, extractJson } from './prompt';
export { callLLM } from './llm';
export * from './types';
