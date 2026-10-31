/**
 * mp_gen —— 页面构建器：把 PageSpecV1 确定性地编译为 WXML/WXSS/JS/JSON 四件套。
 *
 * 设计原则：
 *   - 大模型只提供「数据与结构意图」，模板全部由本模块确定性生成，输出永远可编译。
 *   - 同一页面出现多个同类 section 时，数据键与事件名带上下标后缀避免冲突。
 *   - 用到的 mp_ui_kit 组件会被记录到 usingComponents，由上层注入。
 */

import { FileSpec, Theme, DEFAULT_THEME } from '../core/types';
import { PageSpecV1, Section, GeneratedPage } from './types';

/** 已知的 section 类型 */
export const KNOWN_SECTION_TYPES = [
  'search-bar',
  'swiper',
  'grid-nav',
  'notice',
  'category-tabs',
  'section-title',
  'product-list',
  'cart-fab',
  'skeleton',
  'form',
  'blank',
];

export function isKnownSection(s: Section): boolean {
  return KNOWN_SECTION_TYPES.includes((s as { type: string }).type);
}

/** 单个 section 的渲染产物 */
interface SectionRender {
  wxml: string;
  wxss: string;
  /** 合并进页面 data 的键值对 */
  data: Record<string, unknown>;
  /** 页面方法体（不含外层逗号） */
  handlers: string[];
  /** 依赖的 UI 组件短名 */
  components: string[];
}

/* ------------------------------ 各 section 渲染器 ------------------------------ */

type Renderer = (section: any, idx: number) => SectionRender;

const renderers: Record<string, Renderer> = {
  'search-bar': (s, i) => ({
    wxml: `<view class="mp-search" bindtap="onSearchTap_${i}">
  <text class="mp-search-icon">🔍</text>
  <text class="mp-search-text">{{search_${i}_placeholder}}</text>
  <text class="mp-search-btn">搜索</text>
</view>
`,
    wxss: `.mp-search { display: flex; align-items: center; background: #fff; margin: 24rpx; border-radius: 999rpx; padding: 16rpx 24rpx; box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06); }
.mp-search-icon { font-size: 28rpx; margin-right: 12rpx; }
.mp-search-text { flex: 1; font-size: 26rpx; color: #8a8f99; }
.mp-search-btn { font-size: 26rpx; color: #07C160; }
`,
    data: { [`search_${i}_placeholder`]: s.placeholder || '搜索商品' },
    handlers: [
      `onSearchTap_${i}() { wx.showToast({ title: '点击了搜索框', icon: 'none' }); }`,
    ],
    components: [],
  }),

  swiper: (s, i) => {
    const items: Array<Record<string, unknown>> = Array.isArray(s.items)
      ? s.items.map((it: any, j: number) => ({
          id: it.id != null ? it.id : j + 1,
          image: String(it.image || ''),
          ...(it.title ? { title: String(it.title) } : {}),
        }))
      : (Array.isArray(s.images) ? s.images : []).map((img: string, j: number) => ({
          id: j + 1,
          image: String(img),
        }));
    return {
      wxml: `<view class="mp-swiper">
  <swiper-banner list="{{swiper_${i}_items}}" bindtap="onSwiperTap_${i}"></swiper-banner>
</view>
`,
      wxss: `.mp-swiper { padding: 0 24rpx; }
`,
      data: { [`swiper_${i}_items`]: items },
      handlers: [
        `onSwiperTap_${i}(e) { wx.showToast({ title: '点击轮播 #' + (e.detail.index + 1), icon: 'none' }); }`,
      ],
      components: ['swiper-banner'],
    };
  },

  'grid-nav': (s, i) => ({
    wxml: `<view class="mp-nav">
  <grid-nav items="{{navs_${i}_items}}" bindtap="onNavTap_${i}"></grid-nav>
</view>
`,
    wxss: `.mp-nav { padding: 0 24rpx; }
`,
    data: {
      [`navs_${i}_items`]: (Array.isArray(s.items) ? s.items : []).map((it: any, j: number) => ({
        id: it.id != null ? it.id : j + 1,
        emoji: String(it.emoji || '✨'),
        text: String(it.text || ''),
        color: it.color || '#f2f3f5',
      })),
    },
    handlers: [
      `onNavTap_${i}(e) { wx.showToast({ title: '点击导航 #' + (Number(e.detail.index) + 1), icon: 'none' }); }`,
    ],
    components: ['grid-nav'],
  }),

  notice: (s, i) => ({
    wxml: `<view class="mp-notice" bindtap="onNoticeTap_${i}">
  <text class="mp-notice-icon">📢</text>
  <text class="mp-notice-text">{{notice_${i}_text}}</text>
  <text class="mp-notice-more">详情 ›</text>
</view>
`,
    wxss: `.mp-notice { display: flex; align-items: center; background: #fff8e6; margin: 0 24rpx 24rpx; border-radius: 12rpx; padding: 16rpx 20rpx; }
.mp-notice-icon { font-size: 26rpx; margin-right: 12rpx; }
.mp-notice-text { flex: 1; font-size: 24rpx; color: #8a5a00; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mp-notice-more { font-size: 22rpx; color: #b98a2f; margin-left: 12rpx; }
`,
    data: { [`notice_${i}_text`]: s.text || '暂无公告' },
    handlers: [
      `onNoticeTap_${i}() { wx.showToast({ title: '查看公告', icon: 'none' }); }`,
    ],
    components: [],
  }),

  'category-tabs': (s, i) => ({
    wxml: `<scroll-view class="mp-tabs" scroll-x="{{true}}" show-scrollbar="{{false}}" enhanced="{{true}}">
  <view class="mp-tab {{tabs_${i}_active === index ? 'on' : ''}}" wx:for="{{tabs_${i}_list}}" wx:key="*this" data-index="{{index}}" bindtap="onTabTap_${i}">{{item}}</view>
</scroll-view>
`,
    wxss: `.mp-tabs { white-space: nowrap; padding: 0 12rpx 20rpx; }
.mp-tab { display: inline-block; padding: 12rpx 24rpx; margin: 0 12rpx; font-size: 26rpx; color: #8a8f99; border-radius: 999rpx; background: #fff; }
.mp-tab.on { color: #07C160; font-weight: 600; background: #eafbf1; }
`,
    data: {
      [`tabs_${i}_list`]: Array.isArray(s.tabs) ? s.tabs.map(String) : [],
      [`tabs_${i}_active`]: 0,
    },
    handlers: [
      `onTabTap_${i}(e) { this.setData({ ['tabs_${i}_active']: Number(e.currentTarget.dataset.index) }); }`,
    ],
    components: [],
  }),

  'section-title': (s, i) => ({
    wxml: `<view class="mp-section-title">
  <text class="mp-section-title-text">{{title_${i}}}</text>
  <view class="mp-section-title-line"></view>
</view>
`,
    wxss: `.mp-section-title { display: flex; align-items: center; padding: 8rpx 24rpx 20rpx; }
.mp-section-title-text { font-size: 34rpx; font-weight: 600; color: #1a1a1a; }
.mp-section-title-line { flex: 1; height: 2rpx; background: #ebedf0; margin-left: 20rpx; }
`,
    data: { [`title_${i}`]: s.title || '' },
    handlers: [],
    components: [],
  }),

  'product-list': (s, i) => {
    const products = (Array.isArray(s.products) ? s.products : []).map((p: any, j: number) => ({
      id: p.id != null ? p.id : j + 1,
      name: String(p.name || '未命名商品'),
      desc: p.desc ? String(p.desc) : '',
      price: p.price == null ? '0.00' : String(p.price),
      originPrice: p.originPrice != null ? String(p.originPrice) : '',
      image: String(p.image || 'https://picsum.photos/seed/mp-empty/400/400'),
      sales: typeof p.sales === 'number' ? p.sales : 0,
      tag: p.tag ? String(p.tag) : '',
    }));
    const cols = s.column === 1 ? 1 : 2;
    return {
      wxml: `<view class="mp-products cols-${cols}">
  <product-card
    wx:for="{{products_${i}}}"
    wx:key="id"
    image="{{item.image}}"
    name="{{item.name}}"
    desc="{{item.desc}}"
    price="{{item.price}}"
    origin-price="{{item.originPrice}}"
    sales="{{item.sales}}"
    tag="{{item.tag}}"
    data-index="{{index}}"
    bindtap="onProductTap_${i}"
    bindadd="onAddCart_${i}"
  ></product-card>
</view>
`,
      wxss:
        `.mp-products { display: flex; flex-wrap: wrap; justify-content: space-between; padding: 0 24rpx; }\n` +
        `.mp-products.cols-1 .product-card { width: 100%; margin-bottom: 20rpx; }\n` +
        `.mp-products.cols-2 .product-card { width: 336rpx; margin-bottom: 20rpx; }\n`,
      data: { [`products_${i}`]: products },
      handlers: [
        `onProductTap_${i}(e) { wx.showToast({ title: '查看商品 #' + (Number(e.currentTarget.dataset.index) + 1), icon: 'none' }); }`,
        `onAddCart_${i}(e) { wx.showToast({ title: '已加入购物车：' + (e.detail.name || ''), icon: 'success' }); }`,
      ],
      components: ['product-card'],
    };
  },

  'cart-fab': (s, i) => ({
    wxml: `<fab-button text="{{fab_${i}_text}}" icon="{{fab_${i}_icon}}" badge="{{fab_${i}_badge}}" bindtap="onFabTap_${i}"></fab-button>
`,
    wxss: ``,
    data: {
      [`fab_${i}_text`]: s.text || '购物车',
      [`fab_${i}_icon`]: s.icon || '🛒',
      [`fab_${i}_badge`]: typeof s.badge === 'number' ? s.badge : 0,
    },
    handlers: [`onFabTap_${i}() { wx.showToast({ title: '打开购物车', icon: 'none' }); }`],
    components: ['fab-button'],
  }),

  skeleton: (s, i) => ({
    wxml: `<view class="mp-skeleton">
  <skeleton visible="{{sk_${i}_visible}}" type="{{sk_${i}_type}}" rows="{{sk_${i}_rows}}"></skeleton>
</view>
`,
    wxss: ``,
    data: {
      [`sk_${i}_visible`]: true,
      [`sk_${i}_type`]: s.kind || 'list',
      [`sk_${i}_rows`]: typeof s.rows === 'number' ? s.rows : 3,
    },
    handlers: [],
    components: ['skeleton'],
  }),

  form: (s, i) => {
    const fields = (Array.isArray(s.fields) ? s.fields : []).map((f: any, j: number) => {
      const inputType = ['text', 'number', 'textarea', 'select'].includes(f.inputType) ? f.inputType : 'text';
      return {
        label: String(f.label || `字段${j + 1}`),
        inputType,
        placeholder: f.placeholder ? String(f.placeholder) : `请输入${f.label || ''}`,
        options: inputType === 'select' && Array.isArray(f.options) ? f.options.map(String) : [],
        key: `f${j}`,
      };
    });
    const values: Record<string, string> = {};
    for (const f of fields) values[f.key] = '';
    return {
      wxml: `<view class="mp-form">
  <view class="mp-form-item" wx:for="{{form_${i}_fields}}" wx:key="label">
    <text class="mp-form-label">{{item.label}}</text>
    <block wx:if="{{item.inputType === 'select'}}">
      <picker mode="selector" range="{{item.options}}" data-key="{{item.key}}" bindchange="onFormChange_${i}">
        <view class="mp-form-picker">{{form_${i}_values[item.key] || item.placeholder}}</view>
      </picker>
    </block>
    <block wx:elif="{{item.inputType === 'textarea'}}">
      <textarea class="mp-form-input" placeholder="{{item.placeholder}}" data-key="{{item.key}}" value="{{form_${i}_values[item.key]}}" bindinput="onFormInput_${i}" />
    </block>
    <block wx:else>
      <input class="mp-form-input" type="{{item.inputType === 'number' ? 'number' : 'text'}}" placeholder="{{item.placeholder}}" data-key="{{item.key}}" value="{{form_${i}_values[item.key]}}" bindinput="onFormInput_${i}" />
    </block>
  </view>
  <view class="mp-form-submit" bindtap="onSubmit_${i}">{{submit_${i}_text}}</view>
</view>
`,
      wxss: `.mp-form { background: #fff; margin: 0 24rpx 24rpx; border-radius: 20rpx; padding: 8rpx 28rpx 28rpx; box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.05); }
.mp-form-item { display: flex; align-items: center; padding: 24rpx 0; border-bottom: 1rpx solid #f2f3f5; }
.mp-form-label { width: 160rpx; font-size: 28rpx; color: #1a1a1a; flex-shrink: 0; }
.mp-form-input { flex: 1; font-size: 28rpx; color: #1a1a1a; min-height: 48rpx; }
.mp-form-picker { flex: 1; font-size: 28rpx; color: #8a8f99; }
.mp-form-submit { margin-top: 32rpx; background: #07C160; color: #fff; border-radius: 999rpx; text-align: center; padding: 22rpx 0; font-size: 30rpx; }
`,
      data: {
        [`form_${i}_fields`]: fields,
        [`form_${i}_values`]: values,
        [`submit_${i}_text`]: s.submitText || '提交',
      },
      handlers: [
        `onFormInput_${i}(e) { const k = e.currentTarget.dataset.key; this.setData({ ['form_${i}_values.' + k]: e.detail.value }); }`,
        `onFormChange_${i}(e) { const k = e.currentTarget.dataset.key; this.setData({ ['form_${i}_values.' + k]: String(e.detail.value) }); }`,
        `onSubmit_${i}() { wx.showToast({ title: '提交成功', icon: 'success' }); }`,
      ],
      components: [],
    };
  },

  blank: (s, i) => ({
    wxml: `<view class="mp-blank" style="height:{{blank_${i}}}rpx"></view>
`,
    wxss: ``,
    data: { [`blank_${i}`]: typeof s.height === 'number' ? s.height : 24 },
    handlers: [],
    components: [],
  }),
};

/* ------------------------------ 页面装配 ------------------------------ */

/** 页面名归一化：小写 kebab-case，非法字符转 '-' */
export function pageName(name: unknown): string {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return n || 'page';
}

/**
 * 把一个 PageSpecV1 编译为四件套。
 */
export function buildPage(spec: PageSpecV1, theme: Theme = DEFAULT_THEME): GeneratedPage {
  const name = pageName(spec.name);
  const title = (spec.title || name).trim();
  const sections = Array.isArray(spec.sections) ? spec.sections : [];

  const wxmlParts: string[] = [];
  const wxssParts: string[] = [];
  const data: Record<string, unknown> = {};
  const handlers: string[] = [];
  const componentSet: string[] = [];

  sections.forEach((section, idx) => {
    const type = (section as { type: string }).type;
    const renderer = renderers[type];
    if (!renderer) return; // 未知类型由上层记录 warnings
    const r = renderer(section, idx);
    wxmlParts.push(r.wxml);
    wxssParts.push(r.wxss);
    Object.assign(data, r.data);
    handlers.push(...r.handlers);
    for (const c of r.components) if (!componentSet.includes(c)) componentSet.push(c);
  });

  const wxml = `<view class="mp-page">
${wxmlParts.join('\n')}</view>
`;

  const wxss = `/* 由 mp_gen 自动生成 */
.mp-page { min-height: 100vh; background: ${theme.background}; padding: 24rpx 0 calc(40rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }
${wxssParts.join('\n')}`;

  const dataLiteral = JSON.stringify(data, null, 2)
    .split('\n')
    .map((line, j) => (j === 0 ? line : '  ' + line))
    .join('\n');

  const handlerBlock = handlers.length ? '\n\n  ' + handlers.join('\n\n  ') + '\n' : '';

  const js = `// ${name} 页面（由 mp_gen 自动生成）
Page({
  data: ${dataLiteral},${handlerBlock}
});
`;

  const usingComponents: Record<string, string> = {};
  for (const c of componentSet) usingComponents[c] = `/components/${c}/index`;

  const json =
    JSON.stringify(
      { usingComponents, navigationBarTitleText: title },
      null,
      2,
    ) + '\n';

  const files: FileSpec[] = [
    { path: `pages/${name}/${name}.wxml`, content: wxml },
    { path: `pages/${name}/${name}.wxss`, content: wxss },
    { path: `pages/${name}/${name}.js`, content: js },
    { path: `pages/${name}/${name}.json`, content: json },
  ];

  return { name, files, usingComponents };
}
