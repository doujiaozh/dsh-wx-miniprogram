/**
 * mp_gen —— 类型契约（自然语言 → 严格 JSON → 四件套）。
 *
 * 大模型只负责产出符合 PageSpecV1 / GenResultV1 约束的 JSON，
 * 具体的 WXML/WXSS/JS/JSON 全部由本地 pageBuilder 确定性生成——
 * 这样输出永远可编译、可控制，不依赖模型的「代码正确性」。
 */

/** 生成目标版本号；升级 schema 时递增 */
export const SPEC_VERSION = '1';

/* ---------------- section 类型（页面组成块，共 11 种） ---------------- */

export interface SearchBarSection {
  type: 'search-bar';
  /** 搜索框占位文案，默认「搜索商品」 */
  placeholder?: string;
}

export interface SwiperSection {
  type: 'swiper';
  /** 图片地址列表（与 items 二选一） */
  images?: string[];
  /** 结构化条目：{ id?, image, title? } */
  items?: Array<{ id?: string | number; image: string; title?: string }>;
}

export interface GridNavSection {
  type: 'grid-nav';
  /** 导航项：emoji + 文案 */
  items: Array<{ id?: string | number; emoji?: string; text: string; color?: string }>;
}

export interface NoticeSection {
  type: 'notice';
  /** 公告文案 */
  text?: string;
}

export interface CategoryTabsSection {
  type: 'category-tabs';
  /** 分类 tab 文案列表 */
  tabs: string[];
}

export interface SectionTitleSection {
  type: 'section-title';
  /** 区块标题 */
  title: string;
}

export interface ProductListSection {
  type: 'product-list';
  /** 列数：1 通栏大卡 / 2 双列（默认 2） */
  column?: 1 | 2;
  /** 商品数据 */
  products: Array<{
    id?: string | number;
    name: string;
    price: string | number;
    image: string;
    desc?: string;
    sales?: number;
    tag?: string;
    originPrice?: string | number;
  }>;
}

export interface CartFabSection {
  type: 'cart-fab';
  /** 按钮文案，默认「购物车」 */
  text?: string;
  /** emoji 图标，默认 🛒 */
  icon?: string;
  /** 红点数字 */
  badge?: number;
}

export interface SkeletonSection {
  type: 'skeleton';
  /** 骨架形态：list 列表 / card 卡片 / banner 大图，默认 list */
  kind?: 'list' | 'card' | 'banner';
  /** 行数，默认 3 */
  rows?: number;
}

export interface FormField {
  /** 字段标签 */
  label: string;
  /** 输入类型 */
  inputType?: 'text' | 'number' | 'textarea' | 'select';
  /** 占位文案 */
  placeholder?: string;
  /** select 类型时的选项 */
  options?: string[];
}

export interface FormSection {
  type: 'form';
  /** 表单字段 */
  fields: FormField[];
  /** 提交按钮文案，默认「提交」 */
  submitText?: string;
}

export interface BlankSection {
  type: 'blank';
  /** 空白高度（rpx），默认 24 */
  height?: number;
}

export type Section =
  | SearchBarSection
  | SwiperSection
  | GridNavSection
  | NoticeSection
  | CategoryTabsSection
  | SectionTitleSection
  | ProductListSection
  | CartFabSection
  | SkeletonSection
  | FormSection
  | BlankSection;

export type SectionType = Section['type'];

/* ---------------- 页面 & 结果 ---------------- */

/** 一个待生成的页面 */
export interface PageSpecV1 {
  /** 页面名（目录名/文件名），kebab-case，如 recommend */
  name: string;
  /** 导航栏标题 */
  title?: string;
  /** 页面组成块（按顺序从上到下） */
  sections: Section[];
}

/** 大模型必须输出的严格 JSON */
export interface GenResultV1 {
  /** 固定 '1' */
  version: '1';
  /** 页面列表 */
  pages: PageSpecV1[];
}

/* ---------------- CLI / API 层的输入输出 ---------------- */

/** generatePages 选项 */
export interface GenerateOptions {
  /** 自然语言需求 */
  prompt: string;
  /** 小程序项目根目录 */
  projectRoot: string;
  /** 使用内置演示需求，跳过大模型（不消耗额度） */
  demo?: boolean;
  /** LLM API Key；默认读环境变量 DEEPSEEK_API_KEY / OPENAI_API_KEY / MP_LLM_API_KEY */
  apiKey?: string;
  /** LLM 服务地址，默认 https://api.deepseek.com */
  baseUrl?: string;
  /** 模型名，默认 deepseek-chat（或环境变量 LLM_MODEL） */
  model?: string;
  /** 自动注入用到的 UI 组件，默认 true */
  injectUi?: boolean;
  /** 回写 app.json（pages 等），默认 true */
  updateAppJson?: boolean;
}

/** 单个页面的生成产物描述 */
export interface GeneratedPage {
  /** 页面名 */
  name: string;
  /** 四件套文件清单（相对项目根） */
  files: Array<{ path: string; content: string }>;
  /** 该页面使用的 UI 组件映射 */
  usingComponents: Record<string, string>;
}

/** generatePages 结果 */
export interface GenerateResult {
  pages: GeneratedPage[];
  /** 警告（如未识别的 section 类型），不中断生成 */
  warnings: string[];
  /** 实际使用的模型（demo 模式为空） */
  model?: string;
}
