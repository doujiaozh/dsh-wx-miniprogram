/**
 * skeleton 骨架屏组件（纯原生 WXML/WXSS/JS，零 npm 依赖）。
 *
 * 用法：<skeleton wx:if="{{loading}}" type="list" />（loading 结束后直接移除即可）
 */

export const SKELETON_FILES: { wxml: string; wxss: string; js: string; json: string } = {
  wxml: `<view class="skeleton" wx:if="{{visible}}">
  <block wx:if="{{type === 'list'}}">
    <view class="sk-row" wx:for="{{rows}}" wx:key="*this">
      <view class="sk-thumb shimmer"></view>
      <view class="sk-lines">
        <view class="sk-line shimmer sk-line-70"></view>
        <view class="sk-line shimmer sk-line-40"></view>
      </view>
    </view>
  </block>
  <block wx:elif="{{type === 'card'}}">
    <view class="sk-card shimmer" wx:for="{{rows}}" wx:key="*this"></view>
  </block>
  <block wx:else>
    <view class="sk-banner shimmer"></view>
    <view class="sk-line shimmer sk-line-70"></view>
    <view class="sk-line shimmer sk-line-50"></view>
  </block>
</view>
`,
  wxss: `.skeleton { padding: 24rpx; }
.shimmer { background: linear-gradient(90deg, #f2f3f5 25%, #e8eaee 37%, #f2f3f5 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; border-radius: 12rpx; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
.sk-row { display: flex; background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 20rpx; }
.sk-thumb { width: 160rpx; height: 160rpx; border-radius: 16rpx; flex-shrink: 0; }
.sk-lines { flex: 1; display: flex; flex-direction: column; justify-content: center; margin-left: 24rpx; }
.sk-line { height: 28rpx; margin-bottom: 20rpx; }
.sk-line-70 { width: 70%; }
.sk-line-50 { width: 50%; }
.sk-line-40 { width: 40%; }
.sk-card { width: 336rpx; height: 400rpx; display: inline-block; margin-right: 20rpx; }
.sk-banner { width: 100%; height: 320rpx; border-radius: 20rpx; margin-bottom: 24rpx; }
`,
  js: `Component({
  properties: {
    visible: { type: Boolean, value: true },
    type: { type: String, value: 'list' }, // list | card | banner
    rows: { type: Number, value: 3 },
  },
});
`,
  json: JSON.stringify({ component: true, styleIsolation: 'apply-shared' }, null, 2) + '\n',
};
