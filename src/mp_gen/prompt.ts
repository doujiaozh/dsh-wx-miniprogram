/**
 * mp_gen —— 提示词层。
 *
 * 系统提示强制大模型只输出严格 JSON（GenResultV1），
 * 不允许 markdown 围栏、不允许解释文字。
 */

import { GenResultV1 } from './types';

/** 系统提示：约束输出为严格 JSON */
export const SYSTEM_PROMPT = `你是一个微信小程序页面设计专家。你的任务是把用户的自然语言需求转换为结构化的页面 JSON。

【输出规则】
1. 只输出一个 JSON 对象，不要输出任何 markdown 围栏、不要任何解释文字。
2. JSON 必须符合下面的 TypeScript 类型，未知字段会被丢弃：

type GenResult = {
  version: '1';                         // 固定 '1'
  pages: Array<{
    name: string;                       // 页面名，kebab-case，如 recommend、order-list
    title?: string;                     // 导航栏标题
    sections: Array<Section>;           // 从上到下排列的组成块
  }>;
};

type Section =
  | { type: 'search-bar'; placeholder?: string }
  | { type: 'swiper'; items: Array<{ id?: string|number; image: string; title?: string }> }   // 轮播图
  | { type: 'grid-nav'; items: Array<{ id?: string|number; emoji: string; text: string; color?: string }> }  // 金刚区导航
  | { type: 'notice'; text?: string }   // 公告条
  | { type: 'category-tabs'; tabs: string[] }  // 可切换的分类标签
  | { type: 'section-title'; title: string }   // 区块标题
  | { type: 'product-list'; column?: 1|2; products: Array<{ id?: string|number; name: string; price: string|number; image: string; desc?: string; sales?: number; tag?: string }> }
  | { type: 'cart-fab'; text?: string; icon?: string; badge?: number }  // 购物车悬浮按钮
  | { type: 'skeleton'; kind?: 'list'|'card'|'banner'; rows?: number }  // 骨架屏
  | { type: 'form'; fields: Array<{ label: string; inputType?: 'text'|'number'|'textarea'|'select'; placeholder?: string; options?: string[] }>; submitText?: string }
  | { type: 'blank'; height?: number }; // 空白间距（rpx）

【设计要求】
- 图片用 https://picsum.photos/seed/<唯一种子>/<宽>/<高> 这种占位地址，不要用真实版权图。
- 商品数据要有真实的中文标题、描述、价格与销量，至少 4 个商品。
- emoji 从常用符号中选取（🆕 ⚡ 🏷️ 👑 🎫 💎 📺 🎁 ⭐ 等）。
- 一个需求通常只生成 1 个页面；除非用户明确要求多页面（如「首页 + 详情页」），最多 3 个。
- 价格使用数字或字符串，如 89 或 '89.00'。
`;

/** 组装用户提示词 */
export function buildUserPrompt(prompt: string): string {
  return `请把下面的需求转换为符合规范的 JSON 页面描述：

${prompt}
`;
}

/** 从模型回复中宽松提取 JSON（去围栏 + 首尾大括号定位） */
export function extractJson(content: string): GenResultV1 {
  const raw = content.trim();
  // 去掉可能的 markdown 围栏
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1].trim() : raw;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LLM 输出中找不到 JSON 对象，原始内容前 300 字：' + raw.slice(0, 300));
  }
  const jsonText = text.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`LLM 输出 JSON 解析失败: ${(err as Error).message}；原始内容前 300 字：${jsonText.slice(0, 300)}`);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as GenResultV1).pages)) {
    throw new Error('LLM 输出缺少 pages 数组');
  }
  return parsed as GenResultV1;
}
