import webpush from 'web-push';
import { Setting, PushSubscription } from '../models/index.js';

// Web Push: khóa VAPID lấy từ env, nếu không có thì tự sinh 1 lần và lưu vào DB.
let ready = null;

export function initPush() {
  ready ??= (async () => {
    let publicKey = process.env.VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      const s = await Setting.findOne({ key: 'main' });
      if (s?.vapid?.publicKey) {
        ({ publicKey, privateKey } = s.vapid);
      } else {
        ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
        await Setting.updateOne({ key: 'main' }, { vapid: { publicKey, privateKey } });
        console.log('[push] Đã tạo khóa VAPID mới và lưu vào DB');
      }
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@nutriva.vn', publicKey, privateKey);
    return publicKey;
  })();
  return ready;
}

export const getPublicKey = () => initPush();

// Gửi tới mọi thiết bị của user; tự xóa subscription đã hết hạn (404/410)
export async function sendToUser(userId, payload) {
  await initPush();
  const subs = await PushSubscription.find({ user: userId }).lean();
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 3600 })),
  );
  const dead = subs.filter((_, i) => results[i].status === 'rejected' && [404, 410].includes(results[i].reason?.statusCode));
  if (dead.length) await PushSubscription.deleteMany({ _id: { $in: dead.map((d) => d._id) } });
  return results.filter((r) => r.status === 'fulfilled').length;
}
