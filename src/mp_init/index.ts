/**
 * mp_init —— 极速项目脚手架。
 *
 * 一键生成微信小程序标准目录结构：
 *   app.js / app.json / app.wxss / project.config.json / sitemap.json
 *   pages/index/index.* 四件套（默认附 分类 / 购物车 / 我的 三个 Tab 页）
 *   utils/request.js（Promise 风格网络请求封装）
 *   images/tab-*.png（1x1 透明占位图标，可随时替换）
 *
 * 全部产物为纯文本/二进制文件写入，不依赖 npm、不依赖微信开发者工具 CLI。
 */

import * as path from 'path';
import * as fs from 'fs';
import { FileSpec, TabBarItem, Theme, DEFAULT_THEME } from '../core/types';
import { writeFiles, toPosix } from '../core/fs';

/** 脚手架选项 */
export interface ScaffoldOptions {
  /** 项目名/目录名，默认 mp-demo */
  projectName?: string;
  /** 首页导航栏标题，默认「首页」 */
  appTitle?: string;
  /** 输出父目录，默认当前工作目录 */
  outputRoot?: string;
  /** 自定义底部 TabBar；undefined 用默认四 Tab，[] 表示不要 TabBar */
  tabBar?: TabBarItem[];
  /** 主题，默认微信绿 */
  theme?: Theme;
}

/** 脚手架结果 */
export interface ScaffoldResult {
  /** 项目根目录绝对路径 */
  projectRoot: string;
  /** 已写入的文件清单（相对项目根） */
  files: FileSpec[];
}

const PNG_1x1_TRANSPARENT =
  // 1x1 透明 PNG（67 字节）
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

/** 默认四 Tab：首页 / 分类 / 购物车 / 我的 */
export const DEFAULT_TABS: TabBarItem[] = [
  { pagePath: 'pages/index/index', text: '首页', iconPath: 'images/tab-normal.png', selectedIconPath: 'images/tab-active.png' },
  { pagePath: 'pages/category/category', text: '分类', iconPath: 'images/tab-normal.png', selectedIconPath: 'images/tab-active.png' },
  { pagePath: 'pages/cart/cart', text: '购物车', iconPath: 'images/tab-normal.png', selectedIconPath: 'images/tab-active.png' },
  { pagePath: 'pages/mine/mine', text: '我的', iconPath: 'images/tab-normal.png', selectedIconPath: 'images/tab-active.png' },
];

/** 页面四件套的本地描述，供内部生成器使用 */
interface PageSpec {
  /** 页面名，同时是目录名与文件名，如 index */
  name: string;
  /** 页面标题（导航栏） */
  title: string;
  wxml: string;
  wxss: string;
  js: string;
}

/** 生成公共页面 JS：生命周期 + 数据 + 事件骨架 */
function pageJs(pageName: string, dataLiteral: string, extraMethods = ''): string {
  return `// ${pageName} 页面
const app = getApp();

Page({
  data: ${dataLiteral},

  onLoad() {
    // 页面加载：可在此发起请求（见 utils/request.js）
    // app.request('GET', '/api/xxx').then(res => this.setData({ list: res.data }));
  },

  onShow() {
    // 每次 displayed 时触发
  },

  onPullDownRefresh() {
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    // 上拉加载更多
  },

  ${extraMethods}
});
`;
}

/** 四件套 FileSpec 拼装 */
function fourPieces(page: PageSpec): FileSpec[] {
  return [
    { path: `pages/${page.name}/${page.name}.wxml`, content: page.wxml },
    { path: `pages/${page.name}/${page.name}.wxss`, content: page.wxss },
    { path: `pages/${page.name}/${page.name}.js`, content: page.js },
    {
      path: `pages/${page.name}/${page.name}.json`,
      content: JSON.stringify({ usingComponents: {}, navigationBarTitleText: page.title }, null, 2) + '\n',
    },
  ];
}

/* ------------------------------------------------------------------ *
 * 首页：轮播 + 金刚区 + 商品双列
 * ------------------------------------------------------------------ */
function homePage(title: string): PageSpec {
  const wxml = `<view class="page">
  <swiper class="banner" indicator-dots circular autoplay interval="4000">
    <swiper-item wx:for="{{banners}}" wx:key="id">
      <image class="banner-img" src="{{item.image}}" mode="aspectFill" />
    </swiper-item>
  </swiper>

  <view class="grid-nav">
    <view class="nav-item" wx:for="{{navs}}" wx:key="id" bindtap="onNavTap" data-id="{{item.id}}">
      <view class="nav-icon" style="background:{{item.color}}">{{item.emoji}}</view>
      <text class="nav-text">{{item.text}}</text>
    </view>
  </view>

  <view class="section">
    <text class="section-title">为你推荐</text>
    <view class="product-list">
      <view class="product-card" wx:for="{{products}}" wx:key="id" bindtap="onProductTap" data-id="{{item.id}}">
        <image class="product-img" src="{{item.image}}" mode="aspectFill" />
        <view class="product-info">
          <text class="product-name">{{item.name}}</text>
          <text class="product-desc">{{item.desc}}</text>
          <view class="product-bottom">
            <text class="product-price">¥{{item.price}}</text>
            <text class="product-sales">已售 {{item.sales}}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</view>
`;
  const wxss = `.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 30rpx; }

.banner { width: 100%; height: 320rpx; border-radius: 0 0 24rpx 24rpx; overflow: hidden; }
.banner-img { width: 100%; height: 320rpx; }

.grid-nav { display: flex; flex-wrap: wrap; background: #fff; margin: 24rpx; border-radius: 20rpx; padding: 28rpx 0 12rpx; box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.05); }
.nav-item { width: 25%; display: flex; flex-direction: column; align-items: center; margin-bottom: 24rpx; }
.nav-icon { width: 88rpx; height: 88rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; font-size: 44rpx; }
.nav-text { margin-top: 12rpx; font-size: 24rpx; color: #1a1a1a; }

.section { margin: 24rpx; }
.section-title { font-size: 34rpx; font-weight: 600; color: #1a1a1a; display: block; margin-bottom: 20rpx; }
.product-list { display: flex; flex-wrap: wrap; justify-content: space-between; }
.product-card { width: 336rpx; background: #fff; border-radius: 20rpx; overflow: hidden; margin-bottom: 20rpx; box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06); }
.product-img { width: 336rpx; height: 336rpx; }
.product-info { padding: 16rpx 20rpx 20rpx; }
.product-name { font-size: 28rpx; color: #1a1a1a; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.product-desc { font-size: 22rpx; color: #8a8f99; margin-top: 8rpx; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.product-bottom { display: flex; align-items: baseline; justify-content: space-between; margin-top: 12rpx; }
.product-price { font-size: 32rpx; font-weight: 600; color: #fa5151; }
.product-sales { font-size: 22rpx; color: #8a8f99; }
`;
  const js = pageJs(
    'index',
    JSON.stringify(
      {
        banners: [
          { id: 1, image: 'https://picsum.photos/seed/mp-banner-1/750/320' },
          { id: 2, image: 'https://picsum.photos/seed/mp-banner-2/750/320' },
          { id: 3, image: 'https://picsum.photos/seed/mp-banner-3/750/320' },
        ],
        navs: [
          { id: 1, text: '新品首发', emoji: '🆕', color: '#eafbf1' },
          { id: 2, text: '限时秒杀', emoji: '⚡', color: '#fff3e6' },
          { id: 3, text: '品牌特卖', emoji: '🏷️', color: '#eef4ff' },
          { id: 4, text: '会员中心', emoji: '👑', color: '#fdf0f5' },
          { id: 5, text: '优惠券', emoji: '🎫', color: '#f0ecff' },
          { id: 6, text: '领积分', emoji: '💎', color: '#e6f9f9' },
          { id: 7, text: '直播', emoji: '📺', color: '#fff8e0' },
          { id: 8, text: '更多', emoji: '⋯', color: '#f2f3f5' },
        ],
        products: [
          { id: 1, name: '纯棉宽松 T 恤', desc: '舒适透气，多色可选', price: '89.00', sales: 2310, image: 'https://picsum.photos/seed/mp-goods-1/400/400' },
          { id: 2, name: '小白鞋情侣款', desc: '百搭好穿，限时折扣', price: '199.00', sales: 1862, image: 'https://picsum.photos/seed/mp-goods-2/400/400' },
          { id: 3, name: '无线蓝牙耳机', desc: '降噪长续航', price: '129.00', sales: 5421, image: 'https://picsum.photos/seed/mp-goods-3/400/400' },
          { id: 4, name: '迷你加湿器', desc: '桌面静音两用', price: '59.00', sales: 980, image: 'https://picsum.photos/seed/mp-goods-4/400/400' },
        ],
      },
      null,
      2,
    ),
    `onNavTap(e) { wx.showToast({ title: '点击了导航 ' + e.currentTarget.dataset.id, icon: 'none' }); },
  onProductTap(e) { wx.showToast({ title: '查看商品 ' + e.currentTarget.dataset.id, icon: 'none' }); }`,
  );
  return { name: 'index', title, wxml, wxss, js };
}

/* ------------------------------------------------------------------ *
 * 分类页：侧边分类 + 右侧商品
 * ------------------------------------------------------------------ */
function categoryPage(): PageSpec {
  const wxml = `<view class="page">
  <view class="layout">
    <scroll-view class="sidebar" scroll-y>
      <view
        class="side-item {{activeId === item.id ? 'active' : ''}}"
        wx:for="{{categories}}"
        wx:key="id"
        bindtap="onSwitch"
        data-id="{{item.id}}"
      >{{item.name}}</view>
    </scroll-view>
    <scroll-view class="content" scroll-y>
      <view class="cat-banner">
        <image class="cat-banner-img" src="{{current.banner}}" mode="aspectFill" />
      </view>
      <view class="goods-grid">
        <view class="goods-item" wx:for="{{current.items}}" wx:key="id">
          <image class="goods-img" src="{{item.image}}" mode="aspectFill" />
          <text class="goods-name">{{item.name}}</text>
          <text class="goods-price">¥{{item.price}}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</view>
`;
  const wxss = `.page { height: 100vh; background: #f5f6f8; }
.layout { display: flex; height: 100%; }
.sidebar { width: 180rpx; background: #f2f3f5; height: 100%; }
.side-item { padding: 32rpx 20rpx; font-size: 26rpx; color: #8a8f99; text-align: center; position: relative; }
.side-item.active { background: #fff; color: #07C160; font-weight: 600; }
.side-item.active::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6rpx; height: 36rpx; background: #07C160; border-radius: 3rpx; }
.content { flex: 1; height: 100%; padding: 20rpx; box-sizing: border-box; }
.cat-banner { height: 200rpx; border-radius: 16rpx; overflow: hidden; margin-bottom: 20rpx; }
.cat-banner-img { width: 100%; height: 200rpx; }
.goods-grid { display: flex; flex-wrap: wrap; justify-content: space-between; }
.goods-item { width: 48%; background: #fff; border-radius: 16rpx; overflow: hidden; margin-bottom: 20rpx; }
.goods-img { width: 100%; height: 250rpx; }
.goods-name { display: block; font-size: 26rpx; color: #1a1a1a; padding: 12rpx 16rpx 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.goods-price { display: block; font-size: 30rpx; font-weight: 600; color: #fa5151; padding: 8rpx 16rpx 16rpx; }
`;
  const js = `// category 页面
Page({
  data: {
    activeId: 1,
    categories: [
      { id: 1, name: '上衣', banner: 'https://picsum.photos/seed/mp-cat-1/520/200', items: [
        { id: 11, name: '法式衬衫', price: '129.00', image: 'https://picsum.photos/seed/mp-cat-g1/300/300' },
        { id: 12, name: '针织开衫', price: '159.00', image: 'https://picsum.photos/seed/mp-cat-g2/300/300' },
        { id: 13, name: '打底背心', price: '49.00', image: 'https://picsum.photos/seed/mp-cat-g3/300/300' },
        { id: 14, name: '卫衣 Hoodie', price: '179.00', image: 'https://picsum.photos/seed/mp-cat-g4/300/300' },
      ]},
      { id: 2, name: '鞋靴', banner: 'https://picsum.photos/seed/mp-cat-2/520/200', items: [
        { id: 21, name: '小白鞋', price: '199.00', image: 'https://picsum.photos/seed/mp-cat-g5/300/300' },
        { id: 22, name: '老爹鞋', price: '259.00', image: 'https://picsum.photos/seed/mp-cat-g6/300/300' },
      ]},
      { id: 3, name: '数码', banner: 'https://picsum.photos/seed/mp-cat-3/520/200', items: [
        { id: 31, name: '蓝牙耳机', price: '129.00', image: 'https://picsum.photos/seed/mp-cat-g7/300/300' },
        { id: 32, name: '智能手表', price: '399.00', image: 'https://picsum.photos/seed/mp-cat-g8/300/300' },
      ]},
      { id: 4, name: '家居', banner: 'https://picsum.photos/seed/mp-cat-4/520/200', items: [
        { id: 41, name: '加湿器', price: '59.00', image: 'https://picsum.photos/seed/mp-cat-g9/300/300' },
      ]},
    ],
  },

  get current() {
    return this.data.categories.find((c) => c.id === this.data.activeId);
  },

  onSwitch(e) {
    const id = Number(e.currentTarget.dataset.id);
    this.setData({ activeId: id });
  },
});
`;
  return { name: 'category', title: '分类', wxml, wxss, js };
}

/* ------------------------------------------------------------------ *
 * 购物车页
 * ------------------------------------------------------------------ */
function cartPage(): PageSpec {
  const wxml = `<view class="page">
  <view class="cart-list">
    <view class="cart-item" wx:for="{{carts}}" wx:key="id">
      <view class="check {{item.checked ? 'on' : ''}}" bindtap="onToggle" data-id="{{item.id}}">{{item.checked ? '✓' : ''}}</view>
      <image class="cart-img" src="{{item.image}}" mode="aspectFill" />
      <view class="cart-info">
        <text class="cart-name">{{item.name}}</text>
        <text class="cart-price">¥{{item.price}}</text>
        <view class="stepper">
          <view class="step-btn" bindtap="onMinus" data-id="{{item.id}}">−</view>
          <text class="step-num">{{item.count}}</text>
          <view class="step-btn" bindtap="onPlus" data-id="{{item.id}}">+</view>
        </view>
      </view>
    </view>
  </view>

  <view class="bottom-bar">
    <view class="check {{allChecked ? 'on' : ''}}" bindtap="onToggleAll">{{allChecked ? '✓' : ''}}</view>
    <text class="all-text">全选</text>
    <text class="total">合计 ¥{{total}}</text>
    <view class="checkout-btn" bindtap="onCheckout">去结算 ({{count}})</view>
  </view>
</view>
`;
  const wxss = `.page { min-height: 100vh; background: #f5f6f8; padding: 24rpx 24rpx 140rpx; box-sizing: border-box; }
.cart-item { display: flex; align-items: center; background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 20rpx; box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05); }
.check { width: 44rpx; height: 44rpx; border-radius: 50%; border: 2rpx solid #c9ccd4; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26rpx; flex-shrink: 0; }
.check.on { background: #07C160; border-color: #07C160; }
.cart-img { width: 160rpx; height: 160rpx; border-radius: 16rpx; margin: 0 20rpx; flex-shrink: 0; }
.cart-info { flex: 1; display: flex; flex-direction: column; }
.cart-name { font-size: 28rpx; color: #1a1a1a; }
.cart-price { font-size: 32rpx; font-weight: 600; color: #fa5151; margin-top: 12rpx; }
.stepper { display: flex; align-items: center; margin-top: 16rpx; align-self: flex-end; }
.step-btn { width: 52rpx; height: 52rpx; border-radius: 12rpx; background: #f2f3f5; display: flex; align-items: center; justify-content: center; font-size: 32rpx; color: #1a1a1a; }
.step-num { width: 72rpx; text-align: center; font-size: 28rpx; }
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; height: 110rpx; background: #fff; display: flex; align-items: center; padding: 0 24rpx; box-shadow: 0 -4rpx 24rpx rgba(0, 0, 0, 0.08); box-sizing: border-box; }
.all-text { font-size: 26rpx; color: #1a1a1a; margin-left: 12rpx; }
.total { flex: 1; text-align: right; font-size: 30rpx; font-weight: 600; color: #fa5151; margin-right: 20rpx; }
.checkout-btn { background: #07C160; color: #fff; font-size: 28rpx; border-radius: 999rpx; padding: 16rpx 40rpx; }
`;
  const js = `// cart 页面
Page({
  data: {
    carts: [
      { id: 1, name: '纯棉宽松 T 恤', price: 89.0, count: 1, checked: true, image: 'https://picsum.photos/seed/mp-goods-1/200/200' },
      { id: 2, name: '无线蓝牙耳机', price: 129.0, count: 2, checked: true, image: 'https://picsum.photos/seed/mp-goods-3/200/200' },
    ],
  },

  get allChecked() {
    return this.data.carts.length > 0 && this.data.carts.every((c) => c.checked);
  },

  get total() {
    return this.data.carts.filter((c) => c.checked).reduce((s, c) => s + c.price * c.count, 0).toFixed(2);
  },

  get count() {
    return this.data.carts.filter((c) => c.checked).reduce((s, c) => s + c.count, 0);
  },

  onToggle(e) {
    const id = Number(e.currentTarget.dataset.id);
    const carts = this.data.carts.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c));
    this.setData({ carts });
  },

  onToggleAll() {
    const all = !this.allChecked;
    this.setData({ carts: this.data.carts.map((c) => ({ ...c, checked: all })) });
  },

  onPlus(e) {
    const id = Number(e.currentTarget.dataset.id);
    this.setData({ carts: this.data.carts.map((c) => (c.id === id ? { ...c, count: c.count + 1 } : c)) });
  },

  onMinus(e) {
    const id = Number(e.currentTarget.dataset.id);
    this.setData({ carts: this.data.carts.map((c) => (c.id === id ? { ...c, count: Math.max(1, c.count - 1) } : c)) });
  },

  onCheckout() {
    wx.showToast({ title: '结算 ' + this.count + ' 件商品', icon: 'none' });
  },
});
`;
  return { name: 'cart', title: '购物车', wxml, wxss, js };
}

/* ------------------------------------------------------------------ *
 * 我的页
 * ------------------------------------------------------------------ */
function minePage(): PageSpec {
  const wxml = `<view class="page">
  <view class="header">
    <view class="avatar-row">
      <image class="avatar" src="{{user.avatar}}" mode="aspectFill" />
      <view class="user-meta">
        <text class="nickname">{{user.nickname}}</text>
        <text class="sub">ID: {{user.id}}</text>
      </view>
      <view class="member">会员 ∙ 等级 {{user.level}}</view>
    </view>
    <view class="stat-row">
      <view class="stat" wx:for="{{stats}}" wx:key="label">
        <text class="stat-num">{{item.num}}</text>
        <text class="stat-label">{{item.label}}</text>
      </view>
    </view>
  </view>

  <view class="order-card">
    <view class="card-head">
      <text class="card-title">我的订单</text>
      <text class="card-more" bindtap="onMore">查看全部 ›</text>
    </view>
    <view class="order-grid">
      <view class="order-item" wx:for="{{orders}}" wx:key="label" bindtap="onOrderTap" data-label="{{item.label}}">
        <view class="order-emoji">{{item.emoji}}</view>
        <text class="order-label">{{item.label}}</text>
      </view>
    </view>
  </view>

  <view class="menu-card">
    <view class="menu-item" wx:for="{{menus}}" wx:key="id" bindtap="onMenuTap" data-id="{{item.id}}" hover-class="hover">
      <text class="menu-emoji">{{item.emoji}}</text>
      <text class="menu-text">{{item.text}}</text>
      <text class="menu-arrow">›</text>
    </view>
  </view>
</view>
`;
  const wxss = `.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.header { background: linear-gradient(135deg, #07C160, #10d07a); padding: 60rpx 32rpx 40rpx; color: #fff; }
.avatar-row { display: flex; align-items: center; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; border: 4rpx solid rgba(255, 255, 255, 0.6); }
.user-meta { margin-left: 24rpx; display: flex; flex-direction: column; }
.nickname { font-size: 36rpx; font-weight: 600; }
.sub { font-size: 24rpx; opacity: 0.85; margin-top: 8rpx; }
.member { margin-left: auto; background: rgba(255, 255, 255, 0.22); border-radius: 999rpx; padding: 10rpx 24rpx; font-size: 24rpx; }
.stat-row { display: flex; margin-top: 40rpx; }
.stat { flex: 1; display: flex; flex-direction: column; align-items: center; }
.stat-num { font-size: 36rpx; font-weight: 600; }
.stat-label { font-size: 24rpx; opacity: 0.85; margin-top: 8rpx; }
.order-card { background: #fff; margin: 24rpx; border-radius: 20rpx; padding: 28rpx; box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.05); }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.card-title { font-size: 32rpx; font-weight: 600; color: #1a1a1a; }
.card-more { font-size: 24rpx; color: #8a8f99; }
.order-grid { display: flex; }
.order-item { flex: 1; display: flex; flex-direction: column; align-items: center; }
.order-emoji { font-size: 48rpx; }
.order-label { font-size: 24rpx; color: #1a1a1a; margin-top: 12rpx; }
.menu-card { background: #fff; margin: 24rpx; border-radius: 20rpx; overflow: hidden; box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.05); }
.menu-item { display: flex; align-items: center; padding: 28rpx; border-bottom: 1rpx solid #f2f3f5; }
.menu-item:last-child { border-bottom: none; }
.menu-emoji { font-size: 40rpx; margin-right: 20rpx; }
.menu-text { flex: 1; font-size: 30rpx; color: #1a1a1a; }
.menu-arrow { font-size: 32rpx; color: #c9ccd4; }
.hover { background: #f7f8fa; }
`;
  const js = pageJs(
    'mine',
    JSON.stringify(
      {
        user: {
          avatar: 'https://picsum.photos/seed/mp-avatar/200/200',
          nickname: 'DSH 用户',
          id: '88888888',
          level: 3,
        },
        stats: [
          { num: 12, label: '积分' },
          { num: 5, label: '优惠券' },
          { num: 3, label: '收藏' },
          { num: 26, label: '足迹' },
        ],
        orders: [
          { emoji: '💳', label: '待付款' },
          { emoji: '📦', label: '待发货' },
          { emoji: '🚚', label: '待收货' },
          { emoji: '⭐', label: '待评价' },
          { emoji: '↩️', label: '退款/售后' },
        ],
        menus: [
          { id: 1, emoji: '📍', text: '收货地址' },
          { id: 2, emoji: '🔐', text: '账号与安全' },
          { id: 3, emoji: '🎧', text: '联系客服' },
          { id: 4, emoji: 'ℹ️', text: '关于我们' },
        ],
      },
      null,
      2,
    ),
    `onOrderTap(e) { wx.showToast({ title: e.currentTarget.dataset.label, icon: 'none' }); },
  onMenuTap(e) { wx.showToast({ title: '菜单 ' + e.currentTarget.dataset.id, icon: 'none' }); },
  onMore() { wx.showToast({ title: '查看全部订单', icon: 'none' }); }`,
  );
  return { name: 'mine', title: '我的', wxml, wxss, js };
}

/* ------------------------------------------------------------------ *
 * app 级文件
 * ------------------------------------------------------------------ */
function appJs(theme: Theme): string {
  return `// app.js
App({
  globalData: {
    theme: ${JSON.stringify(theme)},
    // 全局 baseUrl：把下面的占地址换成你的后端服务
    baseUrl: 'https://your-api.example.com',
  },

  onLaunch() {
    // 小程序启动时执行
    console.log('[mp] 小程序已启动');
  },

  /** 统一网络请求入口（与 utils/request.js 配合） */
  request(method, url, data) {
    const { request } = require('./utils/request.js');
    return request(method, url, data);
  },
});
`;
}

function appJson(appTitle: string, tabBar: TabBarItem[] | null): string {
  const app: Record<string, unknown> = {
    pages: [
      'pages/index/index',
      'pages/category/category',
      'pages/cart/cart',
      'pages/mine/mine',
    ],
    window: {
      backgroundTextStyle: 'light',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTitleText: appTitle,
      navigationBarTextStyle: 'black',
      backgroundColor: '#f5f6f8',
      enablePullDownRefresh: false,
    },
    style: 'v2',
    sitemapLocation: 'sitemap.json',
  };
  if (tabBar && tabBar.length) {
    app.tabBar = {
      color: '#8a8f99',
      selectedColor: '#07C160',
      backgroundColor: '#ffffff',
      borderStyle: 'white',
      list: tabBar,
    };
  }
  return JSON.stringify(app, null, 2) + '\n';
}

function appWxss(theme: Theme): string {
  return `/* app.wxss —— 全局样式库（微信小程序） */
page {
  background: ${theme.background};
  color: ${theme.textPrimary};
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 28rpx;
  line-height: 1.6;
}

view, text, image, scroll-view, swiper { box-sizing: border-box; }

/* 文本工具类 */
.text-primary { color: ${theme.primary}; }
.text-secondary { color: ${theme.textSecondary}; }
.text-ellipsis { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.text-ellipsis-2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }

/* 卡片 */
.card { background: #fff; border-radius: 20rpx; padding: 28rpx; margin: 24rpx; box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.05); }

/* 按钮 */
.btn-primary { background: ${theme.primary}; color: #fff; border-radius: 999rpx; text-align: center; padding: 20rpx 0; font-size: 30rpx; }
.btn-plain { background: #fff; color: ${theme.primary}; border: 2rpx solid ${theme.primary}; border-radius: 999rpx; text-align: center; padding: 18rpx 0; font-size: 30rpx; }

/* 安全区 */
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
`;
}

/** utils/request.js：Promise 风格 wx.request 封装 */
function requestJs(): string {
  return `// utils/request.js —— 基础网络请求封装（Promise 风格）
// 用法：
//   const { request, get, post } = require('../../utils/request.js')
//   get('/api/products', { page: 1 }).then(res => ...)

const app = getApp();

function request(method, url, data, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: url.startsWith('http') ? url : (app && app.globalData ? app.globalData.baseUrl : '') + url,
      method: (method || 'GET').toUpperCase(),
      data: data || {},
      timeout: options.timeout || 15000,
      header: Object.assign(
        { 'content-type': 'application/json' },
        options.header || {}
      ),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          wx.showToast({ title: '请求失败 ' + res.statusCode, icon: 'none' });
          reject(new Error('HTTP ' + res.statusCode));
        }
      },
      fail(err) {
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject(err);
      },
    });
  });
}

function get(url, data, options) {
  return request('GET', url, data, options);
}

function post(url, data, options) {
  return request('POST', url, data, options);
}

function put(url, data, options) {
  return request('PUT', url, data, options);
}

function del(url, data, options) {
  return request('DELETE', url, data, options);
}

module.exports = { request, get, post, put, del };
`;
}

/* ------------------------------------------------------------------ *
 * 对外入口
 * ------------------------------------------------------------------ */

/**
 * 生成微信小程序骨架。
 * @param opts 选项，也可以直接传项目名字符串
 * @returns 项目根目录与文件清单
 */
export function scaffoldProject(opts: string | ScaffoldOptions = {}): ScaffoldResult {
  const o: ScaffoldOptions = typeof opts === 'string' ? { projectName: opts } : opts;
  const projectName = (o.projectName || 'mp-demo').trim() || 'mp-demo';
  const appTitle = (o.appTitle || '首页').trim();
  const theme = o.theme || DEFAULT_THEME;
  const outputRoot = path.resolve(o.outputRoot || process.cwd());
  const projectRoot = path.join(outputRoot, projectName);

  const tabBar = o.tabBar === undefined ? DEFAULT_TABS : o.tabBar;
  const tabs: TabBarItem[] = Array.isArray(tabBar) ? tabBar : DEFAULT_TABS;

  const files: FileSpec[] = [];

  // app 级四件套
  files.push({ path: 'app.js', content: appJs(theme) });
  files.push({ path: 'app.json', content: appJson(appTitle, tabs.length ? tabs : null) });
  files.push({ path: 'app.wxss', content: appWxss(theme) });
  files.push({
    path: 'project.config.json',
    content:
      JSON.stringify(
        {
          description: appTitle + ' —— 由 dsh-wx-miniprogram 生成',
          packOptions: { ignore: [], include: [] },
          setting: {
            urlCheck: false,
            esModule: false,
            postcss: true,
            minified: true,
            newFeature: true,
            bigPackageSizeSupport: true,
          },
          compileType: 'miniprogram',
          libVersion: 'latest',
          appid: 'touristappid',
          projectName,
          condition: {},
          editorSetting: { tabIndent: 'insertSpaces', tabSize: 2 },
        },
        null,
        2,
      ) + '\n',
  });
  files.push({
    path: 'sitemap.json',
    content: JSON.stringify({ desc: '关于本文件的更多信息，请参考文档 https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/sitemap.html', rules: [{ action: 'allow', page: '*' }] }, null, 2) + '\n',
  });
  files.push({ path: 'utils/request.js', content: requestJs() });

  // 页面四件套
  for (const page of [homePage(appTitle), categoryPage(), cartPage(), minePage()]) {
    files.push(...fourPieces(page));
  }

  // 文本产物落盘
  writeFiles(projectRoot, files);

  // TabBar 占位图标为二进制，单独写盘（不计入返回的文本清单）
  const binaryFiles: Array<{ path: string; content: Buffer }> = [];
  if (tabs.length) {
    binaryFiles.push({ path: 'images/tab-normal.png', content: Buffer.from(PNG_1x1_TRANSPARENT, 'base64') });
    binaryFiles.push({ path: 'images/tab-active.png', content: Buffer.from(PNG_1x1_TRANSPARENT, 'base64') });
  }
  for (const f of binaryFiles) {
    const abs = path.join(projectRoot, toPosix(f.path));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, f.content);
  }

  return { projectRoot, files };
}
