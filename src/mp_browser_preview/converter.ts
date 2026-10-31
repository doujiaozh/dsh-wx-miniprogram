/**
 * mp_browser_preview —— WXML/WXSS → HTML/CSS 转换器。
 *
 * 目标是「在 Chrome 里看个大概」，不做完整的小程序运行时。策略：
 *   1. 自定义 UI 组件（product-card / swiper-banner / grid-nav / fab-button / skeleton）
 *      内联为等价 HTML 片段，props 属性代入模板占位；组件自身作为 wx:for 宿主时一并展开。
 *   2. wx:for="{{expr}}" 展开为内置模板引擎的 {{#each}} 循环（默认 item 别名）。
 *   3. wx:if="{{expr}}" 包装为 {{#if}} 条件块。
 *   4. WXML 标签映射为 HTML 标签（view→div、text→span、image→img …），剥掉 wx: 与 bind 系列属性。
 *   5. {{...}} 插值用页面 data 渲染（从 JS 的 data 字段提取 JSON）。
 *   6. WXSS 的 rpx 按 375pt 设计稿换算为 px（1rpx = 0.5px）。
 */

import { render } from '../core/template';

/* ----------------------------- 基础工具 ----------------------------- */

/** rpx → px（375pt 设计稿） */
export function rpxToPx(rpx: number): number {
  return rpx / 2;
}

/** WXSS → CSS：rpx 换算、page 选择器替换 */
export function wxssToCss(wxss: string): string {
  return (wxss || '')
    .replace(/(-?\d+(?:\.\d+)?)rpx/g, (_m: string, n: string) => String(Number(n) / 2) + 'px')
    .replace(/(^|\s)page\s*\{/g, '$1body {');
}

const VOID_TAGS = new Set(['image', 'input', 'icon', 'progress', 'video']);

/** 扫描到下一个标签边界（跳过属性中的引号串），返回 '>' 的位置 */
function findTagEnd(html: string, from: number): number {
  let i = from;
  let quote: string | null = null;
  while (i < html.length) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
    i++;
  }
  return -1;
}

interface ElementRange {
  tag: string;
  /** 开标签 '<' 的位置 */
  start: number;
  /** 开标签 '>' 之后的位置 */
  openEnd: number;
  /** 闭标签 '<' 的位置；自闭合时等于 openEnd */
  closeStart: number;
  /** 闭标签 '>' 之后；自闭合时等于 openEnd */
  end: number;
}

/** 从 `<tag ...>` 起始位置找到该元素（含内容）的完整区间，处理同名嵌套与自闭合 */
function elementRange(html: string, start: number): ElementRange | null {
  const openMatch = /^<([A-Za-z][\w-]*)/.exec(html.slice(start));
  if (!openMatch) return null;
  const tag = openMatch[1];
  const gt = findTagEnd(html, start + openMatch[0].length);
  if (gt === -1) return null;
  const selfClosing = html[gt - 1] === '/' || VOID_TAGS.has(tag);
  const openEnd = gt + 1;
  if (selfClosing) return { tag, start, openEnd, closeStart: openEnd, end: openEnd };

  let depth = 1;
  let pos = openEnd;
  while (pos < html.length) {
    const lt = html.indexOf('<', pos);
    if (lt === -1) break;
    const isClose = html[lt + 1] === '/';
    const nameStart = lt + (isClose ? 2 : 1);
    const nameMatch = /^([A-Za-z][\w-]*)/.exec(html.slice(nameStart));
    if (!nameMatch) {
      pos = lt + 1;
      continue;
    }
    const t = nameMatch[1];
    const gt2 = findTagEnd(html, nameStart + nameMatch[0].length);
    if (gt2 === -1) break;
    const tSelfClose = html[gt2 - 1] === '/' || VOID_TAGS.has(t);
    if (t === tag) {
      if (isClose) depth--;
      else if (!tSelfClose) depth++;
      if (depth === 0) return { tag, start, openEnd, closeStart: lt, end: gt2 + 1 };
    }
    pos = gt2 + 1;
  }
  return { tag, start, openEnd, closeStart: openEnd, end: openEnd };
}

/** 解析标签属性字符串为键值表 */
function parseAttrs(attrText: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*"([^"]*)"|'([^']*)')?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrText || '')) !== null) {
    attrs[m[1]] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : '';
  }
  return attrs;
}

interface ElementInfo extends ElementRange {
  attrs: Record<string, string>;
}

/** 按标签名查找所有元素（含属性与内容区间），返回顺序即文档顺序 */
function findElements(html: string, tag: string): ElementInfo[] {
  const out: ElementInfo[] = [];
  const re = new RegExp(`<${tag}\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const range = elementRange(html, m.index);
    if (!range || range.tag !== tag) continue;
    let attrEnd = range.openEnd - 1;
    if (html[attrEnd - 1] === '/') attrEnd--;
    const attrText = html.slice(m.index + tag.length + 1, attrEnd);
    out.push({ ...range, attrs: parseAttrs(attrText) });
    re.lastIndex = Math.max(range.end, m.index + 1);
  }
  return out;
}

/* ----------------------------- UI 组件内联模板 ----------------------------- */

/** 把组件模板里的 {{prop}} 占位替换为实际绑定的属性值 */
function bindProps(tpl: string, attrs: Record<string, string>): string {
  let out = tpl;
  for (const [key, value] of Object.entries(attrs)) {
    const camel = key.replace(/-([a-z])/g, (_m: string, c: string) => c.toUpperCase());
    out = out.replace(new RegExp(`\\{\\{\\s*${camel}\\s*\\}\\}`, 'g'), value);
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
  }
  return out;
}

const COMPONENT_TEMPLATES: Record<string, string> = {
  'product-card': `<div class="mp-card">
  <div class="mp-card-img"><img src="{{image}}" alt="" /><div class="mp-card-tag">{{tag}}</div></div>
  <div class="mp-card-info">
    <div class="mp-card-name">{{name}}</div>
    <div class="mp-card-desc">{{desc}}</div>
    <div class="mp-card-price">¥{{price}} <span class="mp-card-origin">{{originPrice}}</span> <span class="mp-card-sales">{{sales}} 已售</span></div>
  </div>
</div>`,
  'swiper-banner': `<div class="mp-swiper">{{__LIST__}}</div>`,
  'grid-nav': `<div class="mp-gridnav">{{__LIST__}}</div>`,
  'fab-button': `<div class="mp-fab"><span class="mp-fab-icon">{{icon}}</span><span class="mp-fab-text">{{text}}</span><span class="mp-fab-badge">{{badge}}</span></div>`,
  skeleton: `<div class="mp-skeleton"><div class="mp-sk-line"></div><div class="mp-sk-line"></div><div class="mp-sk-line"></div></div>`,
};

const SWIPER_ITEM_TPL = `<div class="mp-swiper-item"><img src="{{item.image}}" alt="" /><div class="mp-swiper-cap">{{item.title}}</div></div>`;
const GRIDNAV_ITEM_TPL = `<div class="mp-gridnav-item"><div class="mp-gridnav-ic" style="background:{{item.color}}">{{item.emoji}}</div><div class="mp-gridnav-tx">{{item.text}}</div></div>`;

/** 内联自定义 UI 组件；组件自身带 wx:for / wx:if 时把展开包在替换结果外层 */
function inlineComponents(html: string): string {
  let out = html;
  for (const [tag, tpl] of Object.entries(COMPONENT_TEMPLATES)) {
    const els = findElements(out, tag);
    // 逆序替换，避免位置失效
    for (let k = els.length - 1; k >= 0; k--) {
      const el = els[k];
      let replacement: string;
      if (tpl.includes('{{__LIST__}}')) {
        const listExpr = (el.attrs.list || el.attrs.items || '[]').replace(/[{}]/g, '').trim();
        const itemTpl = tag === 'swiper-banner' ? SWIPER_ITEM_TPL : GRIDNAV_ITEM_TPL;
        replacement = tpl.replace('{{__LIST__}}', `{{#each ${listExpr} as item}}${itemTpl}{{/each}}`);
      } else {
        replacement = bindProps(tpl, el.attrs);
      }
      if (el.attrs['wx:for']) {
        const expr = el.attrs['wx:for'].replace(/[{}]/g, '').trim();
        replacement = `{{#each ${expr} as item}}${replacement}{{/each}}`;
      }
      if (el.attrs['wx:if']) {
        const expr = el.attrs['wx:if'].replace(/[{}]/g, '').trim();
        replacement = `{{#if ${expr}}}${replacement}{{/if}}`;
      }
      out = out.slice(0, el.start) + replacement + out.slice(el.end);
    }
  }
  return out;
}

/* ----------------------------- wx:for / wx:if 展开 ----------------------------- */

/** 展开所有 wx:for：把元素包进 {{#each expr as item}} ... {{/each}} */
function expandFor(html: string): string {
  let out = html;
  let guard = 0;
  while (guard++ < 50) {
    const m = /<([A-Za-z][\w-]*)((?:[^>]*?)\swx:for="{{([^"]*)}}")/.exec(out);
    if (!m) break;
    const range = elementRange(out, m.index);
    if (!range) break;
    const expr = m[3].trim();
    // 重建开标签：去掉 wx:for / wx:key
    let openTag = out.slice(m.index, range.openEnd);
    openTag = openTag.replace(/\s+wx:for="[^"]*"/, '').replace(/\s+wx:key="[^"]*"/, '');
    const inner = out.slice(range.openEnd, range.closeStart);
    const closeTag = out.slice(range.closeStart, range.end);
    const replacement = `{{#each ${expr} as item}}${openTag}${inner}${closeTag}{{/each}}`;
    out = out.slice(0, m.index) + replacement + out.slice(range.end);
  }
  return out;
}

/** 展开所有 wx:if：把元素包进 {{#if expr}} ... {{/if}} */
function expandIf(html: string): string {
  let out = html;
  let guard = 0;
  while (guard++ < 50) {
    const m = /<([A-Za-z][\w-]*)((?:[^>]*?)\swx:if="{{([^"]*)}}")/.exec(out);
    if (!m) break;
    const range = elementRange(out, m.index);
    if (!range) break;
    const expr = m[3].trim();
    let openTag = out.slice(m.index, range.openEnd);
    openTag = openTag.replace(/\s+wx:if="[^"]*"/, '').replace(/\s+wx:elif="[^"]*"/, '').replace(/\s+wx:else/, '');
    const inner = out.slice(range.openEnd, range.closeStart);
    const closeTag = out.slice(range.closeStart, range.end);
    const replacement = `{{#if ${expr}}}${openTag}${inner}${closeTag}{{/if}}`;
    out = out.slice(0, m.index) + replacement + out.slice(range.end);
  }
  return out;
}

/* ----------------------------- 标签映射 ----------------------------- */

const TAG_MAP: Record<string, string> = {
  view: 'div',
  'scroll-view': 'div',
  block: 'div',
  text: 'span',
  image: 'img',
  navigator: 'a',
  button: 'button',
  textarea: 'textarea',
  picker: 'div',
  icon: 'span',
  progress: 'div',
  label: 'label',
  input: 'input',
  form: 'form',
  canvas: 'div',
  video: 'video',
};

function mapTags(html: string): string {
  let out = html;
  // swiper / swiper-item 走专门的预览样式
  out = out.replace(/<swiper-item\b([^>]*)>/g, '<div class="mp-swiper-item"$1>');
  out = out.replace(/<\/swiper-item>/g, '</div>');
  out = out.replace(/<swiper\b([^>]*)>/g, '<div class="mp-swiper"$1>');
  out = out.replace(/<\/swiper>/g, '</div>');
  // 其余标签按表映射
  out = out.replace(/<\/?([A-Za-z][\w-]*)/g, (whole: string, tag: string) => {
    const mapped = TAG_MAP[tag];
    if (!mapped || !whole) return whole;
    return whole.startsWith('</') ? `</${mapped}` : `<${mapped}`;
  });
  return out;
}

/** 剥掉 wx:* / bind* / catch* 等小程序特有属性 */
function stripMpAttrs(html: string): string {
  return html.replace(/\s+(wx:[A-Za-z-]+|bind:?[A-Za-z-]+|catch:?[A-Za-z-]+|mut:?[A-Za-z-]+)(?=\s*=|\s|>)/g, '');
}

/* ----------------------------- 页面 data 提取 ----------------------------- */

/** 从 JS 的 `data: { ... }` 提取 JSON（生成器产物是纯 JSON，可直接解析） */
export function extractPageData(js: string): Record<string, unknown> {
  const idx = (js || '').indexOf('data:');
  if (idx === -1) return {};
  const start = js.indexOf('{', idx);
  if (start === -1) return {};
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < js.length; i++) {
    const ch = js[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(js.slice(start, i + 1));
        } catch {
          return {};
        }
      }
    }
  }
  return {};
}

/**
 * WXML → HTML（含 data 渲染）。
 * @param wxml 页面 WXML
 * @param data 页面 data（JS 提取）
 */
export function wxmlToHtml(wxml: string, data: Record<string, unknown> = {}): string {
  let html = wxml || '';
  html = inlineComponents(html);
  html = expandFor(html);
  html = expandIf(html);
  html = mapTags(html);
  html = stripMpAttrs(html);
  // data 里的 null/undefined 会被引擎渲染为空串
  html = render(html, data);
  return html;
}

/** 预览所需的 UI 组件最小样式（rpx 已按 375pt 换算） */
export const PREVIEW_EXTRA_CSS = `
.mp-card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.06); margin-bottom: 10px; box-sizing: border-box; }
.mp-card-img { position: relative; }
.mp-card-img img { width: 100%; height: 170px; object-fit: cover; display: block; }
.mp-card-tag { position: absolute; left: 0; top: 0; background: linear-gradient(135deg,#fa5151,#ff7e4d); color: #fff; font-size: 10px; padding: 3px 8px; border-bottom-right-radius: 8px; }
.mp-card-info { padding: 8px 10px 10px; }
.mp-card-name { font-size: 14px; color: #1a1a1a; line-height: 1.45; }
.mp-card-desc { font-size: 11px; color: #8a8f99; margin-top: 4px; }
.mp-card-price { font-size: 16px; font-weight: 700; color: #fa5151; margin-top: 6px; }
.mp-card-origin { font-size: 11px; color: #b0b3ba; text-decoration: line-through; font-weight: 400; }
.mp-card-sales { font-size: 11px; color: #8a8f99; font-weight: 400; }
.mp-products { display: flex; flex-wrap: wrap; justify-content: space-between; }
.mp-products.cols-2 .mp-card { width: calc(50% - 5px); }
.mp-swiper { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; }
.mp-swiper-item { flex: 0 0 100%; scroll-snap-align: start; position: relative; }
.mp-swiper-item img { width: 100%; height: 160px; object-fit: cover; display: block; }
.mp-swiper-cap { position: absolute; left: 12px; bottom: 10px; color: #fff; font-size: 13px; text-shadow: 0 1px 4px rgba(0,0,0,.5); }
.mp-gridnav { display: flex; flex-wrap: wrap; background: #fff; border-radius: 16px; padding: 14px 0 6px; }
.mp-gridnav-item { width: 25%; display: flex; flex-direction: column; align-items: center; margin-bottom: 12px; }
.mp-gridnav-ic { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
.mp-gridnav-tx { font-size: 12px; color: #1a1a1a; margin-top: 6px; }
.mp-fab { position: fixed; right: 20px; bottom: 80px; min-width: 48px; height: 48px; padding: 0 14px; border-radius: 999px; background: rgba(7,193,96,.94); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(7,193,96,.4); z-index: 99; font-size: 13px; }
.mp-fab-icon { font-size: 20px; }
.mp-fab-text { margin-left: 4px; }
.mp-fab-badge { position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; background: #fa5151; color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid #fff; }
.mp-skeleton { padding: 12px; }
.mp-sk-line { height: 14px; margin-bottom: 10px; border-radius: 6px; background: linear-gradient(90deg,#f2f3f5 25%,#e8eaee 37%,#f2f3f5 63%); background-size: 400% 100%; animation: mp-shimmer 1.4s ease infinite; }
.mp-sk-line:nth-child(1) { width: 70%; } .mp-sk-line:nth-child(2) { width: 50%; } .mp-sk-line:nth-child(3) { width: 40%; }
@keyframes mp-shimmer { 0%{background-position:100% 50%} 100%{background-position:0 50%} }
img { background: #f2f3f5; }
`;
