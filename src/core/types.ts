/**
 * DSH WeChat MiniProgram 5-minute generator —— 核心类型契约。
 *
 * 全部插件（mp_init / mp_ui_kit / mp_gen / mp_browser_preview）共享这层契约，
 * 保证四个插件可以独立开发、任意组合调用。
 */

/** 底部 TabBar 单项 */
export interface TabBarItem {
  /** 页面路径，如 pages/index/index */
  pagePath: string;
  /** Tab 文案 */
  text: string;
  /** 普通态图标（项目内相对路径；脚手架默认生成 1x1 占位图标） */
  iconPath?: string;
  /** 选中态图标 */
  selectedIconPath?: string;
}

/** 待写入磁盘的文件描述：path 为相对项目根的 POSIX 风格路径 */
export interface FileSpec {
  /** 相对项目根目录，如 pages/index/index.wxml */
  path: string;
  /** 文件 UTF-8 内容 */
  content: string;
}

/** 主题配置 */
export interface Theme {
  /** 主题色，默认 #07C160（微信绿） */
  primary: string;
  /** 页面底色，默认 #f5f6f8 */
  background: string;
  /** 文字主色，默认 #1a1a1a */
  textPrimary: string;
  /** 文字次要色，默认 #8a8f99 */
  textSecondary: string;
}

export const DEFAULT_THEME: Theme = {
  primary: '#07C160',
  background: '#f5f6f8',
  textPrimary: '#1a1a1a',
  textSecondary: '#8a8f99',
};
