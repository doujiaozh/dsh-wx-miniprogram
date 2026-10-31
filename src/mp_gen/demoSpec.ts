/**
 * mp_gen —— 内置演示需求（demo 模式不消耗任何 LLM 额度）。
 *
 * 覆盖 8 种常见 section，等价于一句真实需求：
 *   「做一个带搜索框、轮播图、金刚区导航、公告、商品双列列表和购物车悬浮按钮的推荐页」
 */

import { GenResultV1 } from './types';

export const DEMO_SPEC: GenResultV1 = {
  version: '1',
  pages: [
    {
      name: 'recommend',
      title: '为你推荐',
      sections: [
        {
          type: 'search-bar',
          placeholder: '搜索你想要的好物',
        },
        {
          type: 'swiper',
          items: [
            { id: 1, image: 'https://picsum.photos/seed/mp-gen-banner-1/750/320', title: '新人专享 5 折起' },
            { id: 2, image: 'https://picsum.photos/seed/mp-gen-banner-2/750/320', title: '夏日清凉节' },
            { id: 3, image: 'https://picsum.photos/seed/mp-gen-banner-3/750/320' },
          ],
        },
        {
          type: 'grid-nav',
          items: [
            { id: 1, emoji: '🆕', text: '新品首发', color: '#eafbf1' },
            { id: 2, emoji: '⚡', text: '限时秒杀', color: '#fff3e6' },
            { id: 3, emoji: '🏷️', text: '品牌特卖', color: '#eef4ff' },
            { id: 4, emoji: '👑', text: '会员中心', color: '#fdf0f5' },
            { id: 5, emoji: '🎫', text: '优惠券', color: '#f0ecff' },
            { id: 6, emoji: '💎', text: '领积分', color: '#e6f9f9' },
            { id: 7, emoji: '📺', text: '直播', color: '#fff8e0' },
            { id: 8, emoji: '🎁', text: '福利社', color: '#ffecec' },
          ],
        },
        { type: 'notice', text: '全场满 99 元包邮，7 天无理由退换货' },
        { type: 'section-title', title: '猜你喜欢' },
        {
          type: 'product-list',
          column: 2,
          products: [
            { id: 1, name: '纯棉宽松 T 恤', desc: '舒适透气，多色可选', price: '89.00', originPrice: '129.00', sales: 2310, tag: '热卖', image: 'https://picsum.photos/seed/mp-gen-g1/400/400' },
            { id: 2, name: '小白鞋情侣款', desc: '百搭好穿，限时折扣', price: '199.00', sales: 1862, image: 'https://picsum.photos/seed/mp-gen-g2/400/400' },
            { id: 3, name: '无线蓝牙耳机', desc: '降噪长续航，开秒杀', price: '129.00', originPrice: '199.00', sales: 5421, tag: '秒杀', image: 'https://picsum.photos/seed/mp-gen-g3/400/400' },
            { id: 4, name: '迷你桌面加湿器', desc: '静音两用，办公室必备', price: '59.00', sales: 980, image: 'https://picsum.photos/seed/mp-gen-g4/400/400' },
            { id: 5, name: '钛钢不粘锅', desc: '少油健康，一冲即净', price: '159.00', sales: 3320, tag: '新品', image: 'https://picsum.photos/seed/mp-gen-g5/400/400' },
            { id: 6, name: '真丝遮阳帽', desc: '折叠便携，UPF50+', price: '69.00', sales: 1543, image: 'https://picsum.photos/seed/mp-gen-g6/400/400' },
          ],
        },
        { type: 'cart-fab', text: '购物车', icon: '🛒', badge: 3 },
      ],
    },
  ],
};
