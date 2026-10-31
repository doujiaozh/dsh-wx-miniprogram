/**
 * grid-nav 导航格（金刚区）组件（纯原生 WXML/WXSS/JS，零 npm 依赖）。
 *
 * 用法：<grid-nav items="{{navs}}" />
 * items: [{ id, text, emoji?, color? }]
 */

export const GRID_NAV_FILES: { wxml: string; wxss: string; js: string; json: string } = {
  wxml: `<view class="grid-nav">
  <view class="nav-item" wx:for="{{items}}" wx:key="id" bindtap="onTap" data-id="{{item.id}}" data-index="{{index}}">
    <view class="nav-icon" style="background:{{item.color || '#f2f3f5'}}">{{item.emoji}}</view>
    <text class="nav-text">{{item.text}}</text>
  </view>
</view>
`,
  wxss: `.grid-nav { display: flex; flex-wrap: wrap; background: #fff; border-radius: 20rpx; padding: 28rpx 0 12rpx; box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.05); }
.nav-item { width: 25%; display: flex; flex-direction: column; align-items: center; margin-bottom: 24rpx; }
.nav-icon { width: 88rpx; height: 88rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; font-size: 44rpx; }
.nav-text { margin-top: 12rpx; font-size: 24rpx; color: #1a1a1a; }
`,
  js: `Component({
  properties: {
    items: { type: Array, value: [] },
  },
  methods: {
    onTap(e) {
      const { id, index } = e.currentTarget.dataset;
      this.triggerEvent('tap', { id, index: Number(index) });
    },
  },
});
`,
  json: JSON.stringify({ component: true, styleIsolation: 'apply-shared' }, null, 2) + '\n',
};
