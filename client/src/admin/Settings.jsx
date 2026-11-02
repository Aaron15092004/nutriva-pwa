import { useEffect, useRef, useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote, Skeleton } from '../components/ui.jsx';
import { Field, StepsInput, ImageInput, NumInput, numError, vnd } from './kit.jsx';
import { SALES_CHANNELS } from '@shared/nutrition.js';

// Mặc định khớp server (services/membership.js, models Setting.interstitial) — cài đặt cũ chưa có 2 mục này
const MEMBERSHIP = { enabled: true, freePlanDays: 3, daysPerBottle: 2, daysPerSet: 4, daysPerTreat: 0, expiryNoticeDays: 2, codesPerReward: 4, rewardDays: 3 };
const INTERSTITIAL = { enabled: true, everyNav: 6, minMinutes: 5, skipSeconds: 3, maxPerDay: 4, skipMembers: false };

// Ô số có kiểm tra khoảng ngay khi nhập (server vẫn kẹp lại giới hạn khi lưu)
function NumberField({ id, label, hint, value, onChange, min = 0, max, money, suffix }) {
  const err = numError(value, { required: true, min, max, integer: true, money });
  return (
    <Field label={label} hint={hint} htmlFor={id} error={err}>
      <NumInput id={id} integer={!money} money={money} suffix={suffix} value={value ?? null} invalid={Boolean(err)} onChange={onChange} />
    </Field>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { data, error, loading } = useApi('/admin/settings');
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Chỉ nạp dữ liệu vào form 1 lần — dữ liệu tải lại ở nền không được xóa thay đổi đang nhập dở
  const loaded = useRef(false);
  useEffect(() => {
    if (data?.item && !loaded.current) {
      loaded.current = true;
      const it = data.item;
      setS({ bank: {}, store: {}, subscriptionPlans: [], diySteps: [], channels: [], popup: {}, ...it, membership: { ...MEMBERSHIP, ...it.membership }, interstitial: { ...INTERSTITIAL, ...it.interstitial } });
    }
  }, [data]);
  const channelOf = (id) => s.channels.find((c) => c.id === id) ?? { id, label: SALES_CHANNELS.find((x) => x.id === id).label, url: '', note: '' };
  const setChannel = (id, patch) => set({ channels: [...s.channels.filter((c) => c.id !== id), { ...channelOf(id), ...patch }].sort((a, b) => SALES_CHANNELS.findIndex((x) => x.id === a.id) - SALES_CHANNELS.findIndex((x) => x.id === b.id)) });
  const setPopup = (patch) => set({ popup: { ...s.popup, ...patch } });
  const setMember = (patch) => set({ membership: { ...s.membership, ...patch } });
  const setAd = (patch) => set({ interstitial: { ...s.interstitial, ...patch } });

  const set = (patch) => setS((x) => ({ ...x, ...patch }));
  const setPlan = (i, patch) => set({ subscriptionPlans: s.subscriptionPlans.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const save = async () => {
    // Còn ô báo đỏ (trống / ngoài khoảng cho phép) → không lưu, đưa con trỏ tới ô đầu tiên
    const bad = document.querySelector('.admin-main .a-field.invalid input, .admin-main input[aria-invalid="true"]');
    if (bad) {
      setSaveError('Kiểm tra lại các ô được đánh dấu đỏ trước khi lưu');
      bad.focus();
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const { item } = await api.put('/admin/settings', s);
      setS((x) => ({ ...x, ...item }));
      toast('Đã lưu cài đặt');
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="admin-head">
        <h1>Cài đặt</h1>
        <Button className="btn-primary btn-sm" loading={saving} disabled={!s} onClick={save}><Save size={16} /> Lưu cài đặt</Button>
      </div>
      <ErrorNote error={error || saveError} />
      {loading && <Skeleton h={400} />}
      {s && (
        <div className="stack-lg">
          <section className="a-card stack">
            <h2 className="title-sm">Giao hàng</h2>
            <div className="a-form">
              <NumberField id="sf" label="Phí giao hàng" money suffix="đ" max={500000} value={s.shippingFee} onChange={(shippingFee) => set({ shippingFee })} />
              <NumberField id="fs" label="Miễn phí giao cho đơn từ" money suffix="đ" hint="0 = không miễn phí" max={100000000} value={s.freeShipFrom} onChange={(freeShipFrom) => set({ freeShipFrom })} />
            </div>
          </section>

          <section className="a-card stack">
            <h2 className="title-sm">Chuyển khoản ngân hàng (VietQR)</h2>
            <p className="small muted">Để trống số tài khoản để tắt phương thức chuyển khoản. Mã ngân hàng theo VietQR, ví dụ: VCB, TCB, MB, ACB, BIDV, VPB, TPB.</p>
            <div className="a-form">
              <Field label="Mã ngân hàng" htmlFor="bi"><input id="bi" className="a-input" value={s.bank?.bankId ?? ''} onChange={(e) => set({ bank: { ...s.bank, bankId: e.target.value.toUpperCase() } })} /></Field>
              <Field label="Số tài khoản" htmlFor="ba"><input id="ba" className="a-input" inputMode="numeric" value={s.bank?.accountNo ?? ''} onChange={(e) => set({ bank: { ...s.bank, accountNo: e.target.value } })} /></Field>
              <Field label="Tên chủ tài khoản" full htmlFor="bn"><input id="bn" className="a-input" value={s.bank?.accountName ?? ''} onChange={(e) => set({ bank: { ...s.bank, accountName: e.target.value } })} /></Field>
            </div>
            {s.bank?.bankId && s.bank?.accountNo && (
              <img alt="Xem trước mã QR" width="160" src={`https://img.vietqr.io/image/${encodeURIComponent(s.bank.bankId)}-${encodeURIComponent(s.bank.accountNo)}-compact2.png?amount=10000&addInfo=TEST&accountName=${encodeURIComponent(s.bank.accountName ?? '')}`} style={{ borderRadius: 10, border: '1px solid var(--border)' }} />
            )}
          </section>

          <section className="a-card stack">
            <h2 className="title-sm">Cửa hàng</h2>
            <div className="a-form">
              <Field label="Tên cửa hàng" htmlFor="sn"><input id="sn" className="a-input" value={s.store?.name ?? ''} onChange={(e) => set({ store: { ...s.store, name: e.target.value } })} /></Field>
              <Field label="Hotline" htmlFor="sp"><input id="sp" className="a-input" value={s.store?.phone ?? ''} onChange={(e) => set({ store: { ...s.store, phone: e.target.value } })} /></Field>
              <Field label="Địa chỉ nhận hàng tại cửa hàng" full htmlFor="sa"><input id="sa" className="a-input" value={s.store?.address ?? ''} onChange={(e) => set({ store: { ...s.store, address: e.target.value } })} /></Field>
            </div>
          </section>

          <section className="a-card stack">
            <h2 className="title-sm">Gói sữa định kỳ</h2>
            {s.subscriptionPlans.map((p, i) => (
              <div key={i} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <input className="a-input" style={{ width: 90 }} aria-label="Mã gói" value={p.id} onChange={(e) => setPlan(i, { id: e.target.value })} />
                <NumInput style={{ width: 120 }} integer suffix="chai" aria-label="Số chai/tuần" value={p.bottles ?? null} invalid={!(p.bottles >= 1 && p.bottles <= 100)} onChange={(bottles) => setPlan(i, { bottles })} />
                <NumInput style={{ width: 150 }} money suffix="đ" aria-label="Giá/tuần" value={p.price ?? null} invalid={!(p.price > 0)} onChange={(price) => setPlan(i, { price })} />
                <input className="a-input grow" aria-label="Nhãn" value={p.label} onChange={(e) => setPlan(i, { label: e.target.value })} />
                <span className="xs muted">{vnd(p.price / (p.bottles || 1))}/chai</span>
                <button className="icon-btn" aria-label="Xóa gói" onClick={() => set({ subscriptionPlans: s.subscriptionPlans.filter((_, j) => j !== i) })}><Trash2 size={16} color="var(--danger)" /></button>
              </div>
            ))}
            <span className="xs muted">Cột: mã • số chai/tuần • giá/tuần (đ) • nhãn hiển thị</span>
            <button className="btn btn-soft btn-xs" style={{ alignSelf: 'flex-start' }} onClick={() => set({ subscriptionPlans: [...s.subscriptionPlans, { id: '', bottles: 7, price: 230000, label: '7 chai / tuần' }] })}><Plus size={15} /> Thêm gói</button>
          </section>

          <section className="a-card stack">
            <h2 className="title-sm">Kênh bán hàng chính thức</h2>
            <p className="small muted">Hiện trong popup, trang Cửa hàng, trang sản phẩm và Cài đặt của khách. Để trống link để ẩn kênh đó.</p>
            {SALES_CHANNELS.map((ch) => {
              const c = channelOf(ch.id);
              return (
                <div key={ch.id} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ width: 100 }}>{ch.label}</b>
                  <input className="a-input grow" style={{ minWidth: 220 }} aria-label={`Link ${ch.label}`} placeholder="https://…" value={c.url ?? ''} onChange={(e) => setChannel(ch.id, { url: e.target.value })} />
                  <input className="a-input" style={{ width: 240 }} aria-label={`Ghi chú ${ch.label}`} placeholder="Ghi chú ngắn (vd: Freeship Xtra)" value={c.note ?? ''} onChange={(e) => setChannel(ch.id, { note: e.target.value })} />
                </div>
              );
            })}
          </section>

          <section className="a-card stack">
            <h2 className="title-sm">Popup quảng cáo khi mở app</h2>
            <p className="small muted">Hiện ở trang chủ / cửa hàng / kế hoạch / theo dõi sau vài giây, mỗi thiết bị tối đa 1 lần trong khoảng thời gian bên dưới. Không hiện với tài khoản vừa đăng ký trong 30 phút.</p>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <label className="a-check"><input type="checkbox" checked={Boolean(s.popup?.enabled)} onChange={(e) => setPopup({ enabled: e.target.checked })} /> Bật popup</label>
              <a href="/?preview=popup" target="_blank" rel="noopener noreferrer" className="btn btn-soft btn-xs">Xem trước popup (lưu cài đặt trước)</a>
            </div>
            <div className="a-form">
              <Field label="Tiêu đề" full htmlFor="pt"><input id="pt" className="a-input" maxLength={80} value={s.popup?.title ?? ''} onChange={(e) => setPopup({ title: e.target.value })} /></Field>
              <Field label="Nội dung" full htmlFor="px"><textarea id="px" className="a-textarea" maxLength={240} value={s.popup?.text ?? ''} onChange={(e) => setPopup({ text: e.target.value })} /></Field>
              <Field label="Chữ trên nút chính" htmlFor="pc"><input id="pc" className="a-input" maxLength={30} value={s.popup?.ctaLabel ?? ''} onChange={(e) => setPopup({ ctaLabel: e.target.value })} /></Field>
              <Field label="Link nút chính" htmlFor="pl" hint="/shop, /shop/subscribe… hoặc https://"><input id="pl" className="a-input" value={s.popup?.ctaLink ?? ''} onChange={(e) => setPopup({ ctaLink: e.target.value })} /></Field>
              <NumberField id="ph" label="Hiện lại sau" suffix="giờ" hint="24 = mỗi ngày 1 lần" min={1} max={720} value={s.popup?.everyHours ?? 24} onChange={(everyHours) => setPopup({ everyHours })} />
              <Field label="Kênh bán hàng" htmlFor="pch"><label className="a-check"><input id="pch" type="checkbox" checked={s.popup?.showChannels !== false} onChange={(e) => setPopup({ showChannels: e.target.checked })} /> Hiện nút Shopee / TikTok / Facebook…</label></Field>
              <Field label="Ảnh" full htmlFor="pi"><ImageInput id="pi" value={s.popup?.image} onChange={(image) => setPopup({ image })} /></Field>
              <Field label="Ghi nguồn ảnh" full htmlFor="pcr"><input id="pcr" className="a-input" value={s.popup?.imageCredit ?? ''} onChange={(e) => setPopup({ imageCredit: e.target.value })} /></Field>
            </div>
          </section>

          <section className="a-card stack">
            <h2 className="title-sm">Gói thành viên & mã kích hoạt</h2>
            <p className="small muted">
              Kế hoạch ăn (từ ngày thứ {(s.membership.freePlanDays ?? 3) + 1}) và nhắc nhở chỉ mở cho tài khoản còn hạn. Hạn được cộng khi khách nhập mã trên chai / gói, hoặc tự động khi đơn mua trong app đã thanh toán (gồm đơn định kỳ). Tắt mục này = mở toàn bộ tính năng cho mọi người.
            </p>
            <label className="a-check"><input type="checkbox" checked={s.membership.enabled !== false} onChange={(e) => setMember({ enabled: e.target.checked })} /> Bật khóa tính năng theo gói thành viên</label>
            <div className="a-form">
              <NumberField id="mf" label="Dùng thử cho tài khoản mới (ngày)" hint="Mở kế hoạch 3/7 ngày đầu; 0 = không dùng thử" max={7} value={s.membership.freePlanDays} onChange={(freePlanDays) => setMember({ freePlanDays })} />
              <NumberField id="mn" label="Báo sắp hết hạn trước (ngày)" hint="Gửi thông báo đẩy 1 lần mỗi ngày; 0 = tắt" max={14} value={s.membership.expiryNoticeDays} onChange={(expiryNoticeDays) => setMember({ expiryNoticeDays })} />
              <NumberField id="mb" label="Mỗi chai sữa hạt cộng (ngày)" max={60} value={s.membership.daysPerBottle} onChange={(daysPerBottle) => setMember({ daysPerBottle })} />
              <NumberField id="ms" label="Mỗi gói hạt tự nấu cộng (ngày)" max={120} value={s.membership.daysPerSet} onChange={(daysPerSet) => setMember({ daysPerSet })} />
              <NumberField id="mt" label="Mỗi món ăn vặt cộng (ngày)" hint="Thường để 0" max={60} value={s.membership.daysPerTreat} onChange={(daysPerTreat) => setMember({ daysPerTreat })} />
              <NumberField id="mr" label="Tích điểm: quét đủ (mã)" suffix="mã" hint="Mỗi mã = 1 tem; 0 = tắt tích điểm" max={50} value={s.membership.codesPerReward} onChange={(codesPerReward) => setMember({ codesPerReward })} />
              <NumberField id="md" label="…thì thưởng thêm (ngày)" suffix="ngày" hint="Cộng tự động khi đủ tem" max={60} value={s.membership.rewardDays} onChange={(rewardDays) => setMember({ rewardDays })} />
            </div>
            <p className="xs muted">Sản phẩm có ô “Ngày dùng app mỗi đơn vị” riêng (trang Sản phẩm) sẽ dùng số đó thay cho mức chung. Ví dụ gói định kỳ 7 chai/tuần → +{7 * (s.membership.daysPerBottle ?? 0)} ngày mỗi kỳ thanh toán.</p>
          </section>

          <section className="a-card stack">
            <h2 className="title-sm">Quảng cáo chuyển trang</h2>
            <p className="small muted">Banner toàn màn hình hiện khi khách chuyển trang trong app, lấy từ các banner có vị trí “Quảng cáo chuyển trang” (trang Quảng cáo & banner). Không hiện ở giỏ hàng, thanh toán, đăng nhập, trợ lý Nuti, trang cá nhân và với tài khoản vừa tạo dưới 30 phút.</p>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <label className="a-check"><input type="checkbox" checked={Boolean(s.interstitial.enabled)} onChange={(e) => setAd({ enabled: e.target.checked })} /> Bật quảng cáo chuyển trang</label>
              <label className="a-check"><input type="checkbox" checked={Boolean(s.interstitial.skipMembers)} onChange={(e) => setAd({ skipMembers: e.target.checked })} /> Không hiện với khách còn hạn gói</label>
            </div>
            <div className="a-form">
              <NumberField id="ie" label="Hiện sau mỗi (lần chuyển trang)" min={2} max={50} value={s.interstitial.everyNav} onChange={(everyNav) => setAd({ everyNav })} />
              <NumberField id="im" label="Cách nhau tối thiểu (phút)" hint="Tính chung với popup khi mở app" min={1} max={1440} value={s.interstitial.minMinutes} onChange={(minMinutes) => setAd({ minMinutes })} />
              <NumberField id="is" label="Cho bỏ qua sau (giây)" min={0} max={10} value={s.interstitial.skipSeconds} onChange={(skipSeconds) => setAd({ skipSeconds })} />
              <NumberField id="id" label="Tối đa mỗi ngày (lần / thiết bị)" min={1} max={50} value={s.interstitial.maxPerDay} onChange={(maxPerDay) => setAd({ maxPerDay })} />
            </div>
          </section>

          <section className="a-card stack">
            <h2 className="title-sm">Hướng dẫn tự nấu mặc định (gói hạt)</h2>
            <p className="small muted">Dùng cho các gói hạt chưa có hướng dẫn riêng trong trang Sản phẩm.</p>
            <StepsInput value={s.diySteps} onChange={(diySteps) => set({ diySteps })} />
          </section>
        </div>
      )}
    </>
  );
}
