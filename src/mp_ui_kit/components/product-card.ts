/**
 * product-card 商品卡片组件（纯原生 WXML/WXSS/JS，零 npm 依赖）。
 *
 * 用法：json 中声明 "product-card": "/components/product-card/index"
 *       <product-card image="..." name="..." desc="..." price="..." sales="{{123}}" />
 */

/** 组件四件套（WXML / WXSS / JS / JSON） */
export const PRODUCT_CARD_FILES: { wxml: string; wxss: string; js: string; json: string } = {
  wxml: `<view class="product-card" bindtap="onTap">
  <view class="img-wrap">
    <image class="product-img" src="{{image}}" mode="aspectFill" lazy-load="{{true}}" />
    <view wx:if="{{tag}}" class="tag">{{tag}}</view>
  </view>
  <view class="info">
    <text class="name">{{name}}</text>
    <text wx:if="{{desc}}" class="desc">{{desc}}</text>
    <view class="bottom">
      <text class="price"><text class="price-sym">¥</text>{{price}}</text>
      <text wx:if="{{sales}}" class="sales">已售 {{sales}}</text>
    </view>
    <view wx:if="{{originPrice}}" class="origin-row">
      <text class="origin">¥{{originPrice}}</text>
      <view class="cart-btn" catchtap="onAdd">＋</view>
    </view>
  </view>
</view>
`,
  wxss: `.product-card { background: #fff; border-radius: 20rpx; overflow: hidden; box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06); }
.img-wrap { position: relative; }
.product-img { width: 100%; height: 340rpx; display: block; }
.tag { position: absolute; left: 0; top: 0; background: linear-gradient(135deg, #fa5151, #ff7e4d); color: #fff; font-size: 20rpx; padding: 6rpx 16rpx; border-bottom-right-radius: 16rpx; }
.info { padding: 16rpx 20rpx 20rpx; }
.name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: 28rpx; color: #1a1a1a; line-height: 1.45; }
.desc { display: block; font-size: 22rpx; color: #8a8f99; margin-top: 8rpx; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.bottom { display: flex; align-items: baseline; justify-content: space-between; margin-top: 14rpx; }
.price { font-size: 34rpx; font-weight: 700; color: #fa5151; }
.price-sym { font-size: 22rpx; font-weight: 400; }
.sales { font-size: 22rpx; color: #8a8f99; }
.origin-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10rpx; }
.origin { font-size: 22rpx; color: #b0b3ba; text-decoration: line-through; }
.cart-btn { width: 44rpx; height: 44rpx; border-radius: 50%; background: #07C160; color: #fff; font-size: 30rpx; display: flex; align-items: center; justify-content: center; }
`,
  js: `Component({
  properties: {
    image: { type: String, value: '' },
    name: { type: String, value: '' },
    desc: { type: String, value: '' },
    price: { type: String, value: '0.00' },
    originPrice: { type: String, value: '' },
    sales: { type: Number, value: 0 },
    tag: { type: String, value: '' },
  },
  methods: {
    onTap() { this.triggerEvent('tap', { name: this.data.name }); },
    onAdd() { this.triggerEvent('add', { name: this.data.name }); },
  },
});
`,
  json: JSON.stringify({ component: true, styleIsolation: 'apply-shared' }, null, 2) + '\n',
};
