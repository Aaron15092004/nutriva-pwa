import { useEffect, useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote, Skeleton } from '../components/ui.jsx';
import { Field, StepsInput, vnd } from './kit.jsx';

export default function SettingsPage() {
  const toast = useToast();
  const { data, error, loading } = useApi('/admin/settings');
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (data?.item) setS({ bank: {}, store: {}, subscriptionPlans: [], diySteps: [], ...data.item });
  }, [data]);

  const set = (patch) => setS((x) => ({ ...x, ...patch }));
  const setPlan = (i, patch) => set({ subscriptionPlans: s.subscriptionPlans.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const save = async () => {
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
              <Field label="Phí giao hàng (đ)" htmlFor="sf"><input id="sf" className="a-input" type="number" min="0" step="1000" value={s.shippingFee ?? 0} onChange={(e) => set({ shippingFee: Number(e.target.value) })} /></Field>
              <Field label="Miễn phí giao cho đơn từ (đ)" htmlFor="fs" hint="0 = không miễn phí"><input id="fs" className="a-input" type="number" min="0" step="1000" value={s.freeShipFrom ?? 0} onChange={(e) => set({ freeShipFrom: Number(e.target.value) })} /></Field>
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
                <input className="a-input" style={{ width: 110 }} type="number" min="1" aria-label="Số chai/tuần" value={p.bottles} onChange={(e) => setPlan(i, { bottles: Number(e.target.value) })} />
                <input className="a-input" style={{ width: 140 }} type="number" min="0" step="1000" aria-label="Giá/tuần" value={p.price} onChange={(e) => setPlan(i, { price: Number(e.target.value) })} />
                <input className="a-input grow" aria-label="Nhãn" value={p.label} onChange={(e) => setPlan(i, { label: e.target.value })} />
                <span className="xs muted">{vnd(p.price / (p.bottles || 1))}/chai</span>
                <button className="icon-btn" aria-label="Xóa gói" onClick={() => set({ subscriptionPlans: s.subscriptionPlans.filter((_, j) => j !== i) })}><Trash2 size={16} color="var(--danger)" /></button>
              </div>
            ))}
            <span className="xs muted">Cột: mã • số chai/tuần • giá/tuần (đ) • nhãn hiển thị</span>
            <button className="btn btn-soft btn-xs" style={{ alignSelf: 'flex-start' }} onClick={() => set({ subscriptionPlans: [...s.subscriptionPlans, { id: '', bottles: 7, price: 230000, label: '7 chai / tuần' }] })}><Plus size={15} /> Thêm gói</button>
          </section>

          <section className="a-card stack">
            <h2 className="title-sm">Hướng dẫn tự làm mặc định (set DIY)</h2>
            <p className="small muted">Dùng cho các set chưa có hướng dẫn riêng trong trang Sản phẩm.</p>
            <StepsInput value={s.diySteps} onChange={(diySteps) => set({ diySteps })} />
          </section>
        </div>
      )}
    </>
  );
}
