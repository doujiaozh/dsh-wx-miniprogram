/**
 * fab-button 悬浮按钮组件（纯原生 WXML/WXSS/JS，零 npm 依赖）。
 *
 * 用法：<fab-button text="购物车" badge="{{count}}" />
 */

export const FAB_BUTTON_FILES: { wxml: string; wxss: string; js: string; json: string } = {
  wxml: `<view class="fab {{position}}" bindtap="onTap">
  <text wx:if="{{icon}}" class="fab-icon">{{icon}}</text>
  <text wx:if="{{text}}" class="fab-text">{{text}}</text>
  <view wx:if="{{badge}}" class="fab-badge">{{badge > 99 ? '99+' : badge}}</view>
</view>
`,
  wxss: `.fab { position: fixed; right: 40rpx; bottom: 120rpx; min-width: 96rpx; height: 96rpx; padding: 0 28rpx; border-radius: 999rpx; background: rgba(7, 193, 96, 0.94); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 12rpx 32rpx rgba(7, 193, 96, 0.4); z-index: 99; }
.fab.center { left: 50%; right: auto; transform: translateX(-50%); }
.fab.left { left: 40rpx; right: auto; }
.fab-icon { font-size: 40rpx; }
.fab-text { font-size: 26rpx; margin-left: 8rpx; }
.fab-badge { position: absolute; top: -10rpx; right: -10rpx; min-width: 36rpx; height: 36rpx; padding: 0 8rpx; border-radius: 999rpx; background: #fa5151; color: #fff; font-size: 20rpx; display: flex; align-items: center; justify-content: center; border: 2rpx solid #fff; }
`,
  js: `Component({
  properties: {
    text: { type: String, value: '' },
    icon: { type: String, value: '🛒' },
    badge: { type: Number, value: 0 },
    position: { type: String, value: 'right' }, // right | center | left
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { text: this.data.text });
      if (this.data.vibrate !== false) wx.vibrateShort && wx.vibrateShort({ type: 'light' });
    },
  },
});
`,
  json: JSON.stringify({ component: true, styleIsolation: 'apply-shared' }, null, 2) + '\n',
};
