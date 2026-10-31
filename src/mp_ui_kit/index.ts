/**
 * mp_ui_kit —— 内置轻量级 UI 组件库。
 *
 * 绕过 npm 安装：把组件源码（WXML/WXSS/JS/JSON）直接以文件形式拷贝注入到目标项目的
 * components/<名>/ 目录下，页面在 json 的 usingComponents 里引用即可。
 *
 * 内置组件：
 *   product-card   商品卡片（图 + 标题 + 描述 + 价格 + 加购按钮）
 *   swiper-banner  轮播图（自动播放 / 圆点指示 / 点击事件）
 *   grid-nav       导航格（金刚区，emoji 图标 + 文案）
 *   fab-button     悬浮按钮（badge 红点 / 触感反馈）
 *   skeleton       骨架屏（shimmer 动画，list/card/banner 三种形态）
 */

import * as path from 'path';
import { FileSpec } from '../core/types';
import { writeFiles } from '../core/fs';
import { PRODUCT_CARD_FILES } from './components/product-card';
import { SWIPER_BANNER_FILES } from './components/swiper-banner';
import { GRID_NAV_FILES } from './components/grid-nav';
import { FAB_BUTTON_FILES } from './components/fab-button';
import { SKELETON_FILES } from './components/skeleton';

/** 组件清单：短名 → 四件套 */
export interface KitComponent {
  /** 组件短名，也是目录名 */
  name: string;
  /** 一句话描述 */
  description: string;
  /** 四件套内容 */
  files: { wxml: string; wxss: string; js: string; json: string };
}

export const UI_KIT: KitComponent[] = [
  { name: 'product-card', description: '商品卡片：图 + 标题 + 描述 + 价格 + 加购按钮', files: PRODUCT_CARD_FILES },
  { name: 'swiper-banner', description: '轮播图：自动播放 / 圆点指示 / 点击事件', files: SWIPER_BANNER_FILES },
  { name: 'grid-nav', description: '导航格（金刚区）：emoji 图标 + 文案', files: GRID_NAV_FILES },
  { name: 'fab-button', description: '悬浮按钮：badge 红点 + 触感反馈', files: FAB_BUTTON_FILES },
  { name: 'skeleton', description: '骨架屏：shimmer 动画，list/card/banner 三种形态', files: SKELETON_FILES },
];

/** 列出全部可用组件短名 */
export function listComponents(): string[] {
  return UI_KIT.map((c) => c.name);
}

/** 注入结果 */
export interface InjectResult {
  /** 已写入的文件清单（FileSpec） */
  written: FileSpec[];
  /** usingComponents 映射，可直接并到页面 json 里 */
  usingComponents: Record<string, string>;
}

/**
 * 向目标项目注入 UI 组件（文件拷贝，无 npm）。
 * @param projectRoot 小程序项目根目录
 * @param components  只注入这些组件（短名）；留空注入全部
 */
export function injectUiKit(projectRoot: string, components?: string[]): InjectResult {
  if (!projectRoot) throw new Error('injectUiKit 需要提供 projectRoot');
  const root = path.resolve(projectRoot);

  const wanted = (components && components.length ? components : listComponents())
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const unknown = wanted.filter((w) => !listComponents().includes(w));
  if (unknown.length) throw new Error(`未知组件：${unknown.join('、')}；可用组件：${listComponents().join('、')}`);

  const files: FileSpec[] = [];
  const usingComponents: Record<string, string> = {};

  for (const comp of UI_KIT) {
    if (!wanted.includes(comp.name)) continue;
    files.push({ path: `components/${comp.name}/index.wxml`, content: comp.files.wxml });
    files.push({ path: `components/${comp.name}/index.wxss`, content: comp.files.wxss });
    files.push({ path: `components/${comp.name}/index.js`, content: comp.files.js });
    files.push({ path: `components/${comp.name}/index.json`, content: comp.files.json });
    usingComponents[comp.name] = `/components/${comp.name}/index`;
  }

  writeFiles(root, files);
  return { written: files, usingComponents };
}
