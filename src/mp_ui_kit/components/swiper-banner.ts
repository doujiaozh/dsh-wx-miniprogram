/**
 * swiper-banner 轮播图组件（纯原生 WXML/WXSS/JS，零 npm 依赖）。
 *
 * 用法：<swiper-banner list="{{banners}}" />
 * list: [{ id, image, link? }]
 */

export const SWIPER_BANNER_FILES: { wxml: string; wxss: string; js: string; json: string } = {
  wxml: `<swiper
  class="swiper"
  indicator-dots="{{indicatorDots}}"
  indicator-color="rgba(255,255,255,0.6)"
  indicator-active-color="#ffffff"
  autoplay="{{autoplay}}"
  interval="{{interval}}"
  duration="{{duration}}"
  circular="{{circular}}"
  bindchange="onChange"
>
  <swiper-item wx:for="{{list}}" wx:key="id" bindtap="onTap" data-index="{{index}}">
    <image class="img" src="{{item.image}}" mode="aspectFill" />
    <view wx:if="{{item.title}}" class="caption">{{item.title}}</view>
  </swiper-item>
</swiper>
`,
  wxss: `.swiper { width: 100%; height: 320rpx; border-radius: 20rpx; overflow: hidden; }
.img { width: 100%; height: 320rpx; display: block; }
.caption { position: absolute; left: 24rpx; bottom: 20rpx; color: #fff; font-size: 26rpx; text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.5); }
`,
  js: `Component({
  properties: {
    list: { type: Array, value: [] },
    indicatorDots: { type: Boolean, value: true },
    autoplay: { type: Boolean, value: true },
    interval: { type: Number, value: 4000 },
    duration: { type: Number, value: 500 },
    circular: { type: Boolean, value: true },
  },
  methods: {
    onTap(e) {
      const idx = Number(e.currentTarget.dataset.index);
      this.triggerEvent('tap', { index: idx, item: this.data.list[idx] });
    },
    onChange(e) {
      this.triggerEvent('change', { current: e.detail.current });
    },
  },
});
`,
  json: JSON.stringify({ component: true, styleIsolation: 'apply-shared' }, null, 2) + '\n',
};
