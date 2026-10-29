import { Event } from '../models/index.js';

// Sự kiện sản phẩm (phục vụ thống kê admin: phễu onboarding, tính năng hay dùng, giữ chân người dùng).
// Server tự ghi các sự kiện quan trọng; client chỉ được gửi các loại trong CLIENT_EVENTS.
export const CLIENT_EVENTS = new Set([
  'app.open', // mở app (tối đa 1 lần/ngày/thiết bị)
  'app.install', // đã cài PWA
  'onboarding.step', // props.step = id bước
  'onboarding.start',
  'plan.view',
  'shop.view',
  'assistant.open',
  'promo.click', // props.id, props.placement
  'popup.view',
  'popup.click', // props.target: 'cta' | id kênh
  'channel.click', // props.channel, props.from
  'ad.view', // quảng cáo chuyển trang — props.id
  'ad.click',
  'paywall.view', // màn hình mời kích hoạt — props.feature
]);

export const platformOf = (ua = '') => (/android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'desktop');

export async function track(type, { user = null, anon, props, req } = {}) {
  try {
    await Event.create({
      type,
      user: user?._id ?? user ?? null,
      anon,
      props,
      platform: req ? platformOf(req.headers['user-agent']) : undefined,
    });
  } catch (e) {
    console.error('[event]', type, e.message);
  }
}
