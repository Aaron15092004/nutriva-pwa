import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Download, Printer, Search, Ban, Power } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote, Skeleton } from '../components/ui.jsx';
import { Drawer, Field, dt, downloadFile, useDebounced } from './kit.jsx';
import { StatTile } from './charts.jsx';

const n = (v) => (v ?? 0).toLocaleString('vi-VN');

function CreateDrawer({ open, onClose, onCreated, products, config }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', productSlug: '', quantity: 100, days: config?.daysPerBottle ?? 2, expiresAt: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const pickProduct = (slug) => {
    const p = products.find((x) => x.slug === slug);
    const days = p ? (p.membershipDays ?? (p.type === 'diy' ? config?.daysPerSet : config?.daysPerBottle) ?? f.days) : f.days;
    set({ productSlug: slug, days, name: f.name || (p ? `${p.type === 'diy' ? 'Gói hạt' : 'Sữa'} ${p.name} — ${new Date().toLocaleDateString('vi-VN')}` : '') });
  };
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const { item } = await api.post('/admin/activation', { ...f, expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59+07:00`).toISOString() : null });
      toast(`Đã tạo ${item.quantity} mã`);
      onCreated(item);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer
      open={open}
      title="Tạo lô mã kích hoạt"
      onClose={onClose}
      footer={
        <Button className="btn-primary btn-sm" loading={busy} onClick={submit}>
          <Plus size={16} /> Tạo mã
        </Button>
      }
    >
      <p className="small muted">Mỗi mã in thành 1 tem (QR + mã 10 ký tự) dán lên 1 chai / gói. Người mua quét hoặc nhập mã trong app để cộng ngày sử dụng. Mẹo: tạo mã khi nhập kho (trang Kho hàng) để mã gắn với lô hàng.</p>
      <div className="a-form">
        <Field label="Sản phẩm (tùy chọn)" htmlFor="ab-p">
          <select id="ab-p" className="a-select" value={f.productSlug} onChange={(e) => pickProduct(e.target.value)}>
            <option value="">— Không gắn sản phẩm —</option>
            {products.filter((p) => p.type !== 'treat').map((p) => (
              <option key={p.slug} value={p.slug}>{p.type === 'diy' ? 'Gói hạt' : 'Sữa'} {p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Tên lô mã" htmlFor="ab-n"><input id="ab-n" className="a-input" maxLength={80} value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Số lượng mã" htmlFor="ab-q" hint="Tối đa 20.000 mã / lô"><input id="ab-q" className="a-input" type="number" min="1" max="20000" value={f.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} /></Field>
        <Field label="Số ngày mỗi mã" htmlFor="ab-d" hint={`Mặc định: chai ${config?.daysPerBottle} ngày • gói hạt ${config?.daysPerSet} ngày`}><input id="ab-d" className="a-input" type="number" min="1" max="365" value={f.days} onChange={(e) => set({ days: Number(e.target.value) })} /></Field>
        <Field label="Hạn kích hoạt (tùy chọn)" htmlFor="ab-e" hint="Sau ngày này mã không còn dùng được"><input id="ab-e" className="a-input" type="date" value={f.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} /></Field>
        <Field label="Ghi chú" htmlFor="ab-no"><input id="ab-no" className="a-input" maxLength={200} value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
      </div>
      <ErrorNote error={error} />
    </Drawer>
  );
}

function BatchDrawer({ batch, onClose, onChanged }) {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const search = useDebounced(q);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const qs = new URLSearchParams(Object.entries({ status, q: search }).filter(([, v]) => v)).toString();
      setData(await api.get(`/admin/activation/${batch._id}/codes?${qs}`));
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);
  const toggle = async () => {
    const { item } = await api.patch(`/admin/activation/${batch._id}`, { active: !batch.active });
    toast(item.active ? 'Đã bật lại lô mã' : 'Đã ngừng lô mã — các mã chưa dùng không kích hoạt được nữa');
    onChanged({ ...batch, active: item.active });
  };
  const voidCode = async (c) => {
    if (!window.confirm(`Vô hiệu mã ${c.pretty}?`)) return;
    await api.post(`/admin/activation/codes/${c.code}/void`);
    load();
  };
  return (
    <Drawer
      open
      title={batch.name}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-soft btn-sm" style={{ marginRight: 'auto' }} onClick={toggle}>
            <Power size={16} /> {batch.active ? 'Ngừng lô mã' : 'Bật lại'}
          </button>
          <button className="btn btn-soft btn-sm" onClick={() => downloadFile(`/admin/activation/${batch._id}/codes?format=csv`, `ma-kich-hoat-${batch._id}.csv`).catch((e) => toast(e.message, 'error'))}>
            <Download size={16} /> Tải CSV
          </button>
          <Link className="btn btn-primary btn-sm" to={`/admin/activation/${batch._id}/print`} target="_blank">
            <Printer size={16} /> In tem QR
          </Link>
        </>
      }
    >
      <dl className="a-kv">
        <dt>Mỗi mã</dt><dd>+{batch.days} ngày sử dụng</dd>
        <dt>Sản phẩm</dt><dd>{batch.productSlug ?? '—'}{batch.lot ? ` • lô ${batch.lot.code}` : ''}</dd>
        <dt>Đã dùng</dt><dd>{n(batch.used)} / {n(batch.quantity)}{batch.void ? ` • vô hiệu ${n(batch.void)}` : ''}</dd>
        <dt>Hạn kích hoạt</dt><dd>{batch.expiresAt ? dt(batch.expiresAt) : 'Không giới hạn'}</dd>
        <dt>Tạo bởi</dt><dd>{batch.createdBy} • {dt(batch.createdAt)}</dd>
      </dl>
      <div className="a-toolbar">
        <label className="a-input a-search inline-flex items-center gap-2">
          <Search size={16} className="text-subtle" aria-hidden="true" />
          <input aria-label="Tìm mã" placeholder="Tìm mã (vài ký tự đầu)" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <select className="a-select" aria-label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="new">Chưa dùng</option>
          <option value="used">Đã dùng</option>
          <option value="void">Vô hiệu</option>
        </select>
      </div>
      <ErrorNote error={error} />
      {!data ? (
        <Skeleton h={200} />
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead><tr><th>Mã</th><th>Trạng thái</th><th>Người dùng</th><th /></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c._id} className="!cursor-default">
                  <td className="font-mono text-sm">{c.pretty}</td>
                  <td><span className={`badge ${c.status === 'used' ? 'good' : c.status === 'void' ? 'gray' : 'blue'}`}>{c.status === 'used' ? 'Đã dùng' : c.status === 'void' ? 'Vô hiệu' : 'Chưa dùng'}</span></td>
                  <td className="small">{c.usedBy ? `${c.usedBy.email} • ${dt(c.usedAt)}` : '—'}</td>
                  <td className="num">{c.status === 'new' && <button className="icon-btn" aria-label={`Vô hiệu ${c.pretty}`} onClick={() => voidCode(c)}><Ban size={16} color="var(--danger)" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.total > data.items.length && <div className="a-empty">Hiển thị {data.items.length}/{n(data.total)} mã — tải CSV để xem đủ</div>}
        </div>
      )}
    </Drawer>
  );
}

// Trang quản lý mã kích hoạt (in trên chai / gói hạt)
export default function Activation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null);
  const [products, setProducts] = useState([]);
  const [lookup, setLookup] = useState('');
  const [found, setFound] = useState(null);
  const load = () => api.get('/admin/activation').then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.get('/admin/products?limit=200').then((d) => setProducts(d.items)).catch(() => {});
  }, []);
  const doLookup = async (e) => {
    e.preventDefault();
    setFound(null);
    try {
      setFound((await api.get(`/admin/activation/lookup/${encodeURIComponent(lookup)}`)).item);
    } catch (x) {
      setFound({ error: x.message });
    }
  };
  const totals = useMemo(() => (data?.items ?? []).reduce((t, b) => ({ codes: t.codes + b.quantity, used: t.used + b.used }), { codes: 0, used: 0 }), [data]);

  return (
    <>
      <div className="admin-head">
        <h1>Mã kích hoạt</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={16} /> Tạo lô mã</button>
      </div>
      <ErrorNote error={error} />
      {!data ? (
        <Skeleton h={300} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="a-grid-4">
            <StatTile label="Thành viên đang có gói" value={n(data.stats.activeMembers)} />
            <StatTile label="Mã đã kích hoạt (30 ngày)" value={n(data.stats.used30)} />
            <StatTile label="Tổng mã đã phát hành" value={n(totals.codes)} sub={`Đã dùng ${n(totals.used)} (${totals.codes ? Math.round((totals.used / totals.codes) * 100) : 0}%)`} />
            <StatTile label="Quy đổi hiện tại" value={`${data.config.daysPerBottle} ngày / chai`} sub={`Gói hạt ${data.config.daysPerSet} ngày • dùng thử ${data.config.freePlanDays}/7 ngày — đổi ở Cài đặt`} />
          </div>
          <form className="a-toolbar !mb-0" onSubmit={doLookup}>
            <input className="a-input a-search font-mono" aria-label="Tra cứu mã" placeholder="Tra cứu 1 mã: XXXXX-XXXXX" value={lookup} onChange={(e) => setLookup(e.target.value)} />
            <button className="btn btn-soft btn-sm" type="submit" disabled={!lookup.trim()}><Search size={16} /> Tra cứu</button>
            {found && (
              <span className="small">
                {found.error ? (
                  <span className="text-warm-dark">{found.error}</span>
                ) : (
                  <>
                    <b className="font-mono">{found.pretty}</b> • {found.status === 'used' ? `đã dùng bởi ${found.usedBy?.email ?? '—'} lúc ${dt(found.usedAt)}` : found.status === 'void' ? 'đã vô hiệu' : 'chưa dùng'} • lô “{found.batch?.name}” (+{found.days} ngày){found.batch?.active === false ? ' • lô đã ngừng' : ''}
                  </>
                )}
              </span>
            )}
          </form>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Lô mã</th><th className="num">Ngày / mã</th><th className="num">Đã dùng</th><th>Tạo lúc</th><th>Hạn kích hoạt</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b._id} onClick={() => setOpen(b)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(b)}>
                    <td><b>{b.name}</b><div className="xs muted">{b.productSlug ?? 'Không gắn sản phẩm'}{b.lot ? ` • lô ${b.lot.code}` : ''}</div></td>
                    <td className="num">+{b.days}</td>
                    <td className="num">
                      {n(b.used)} / {n(b.quantity)}
                      <div className="ml-auto mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-surface"><i className="block h-full bg-brand-main" style={{ width: `${(b.used / b.quantity) * 100}%` }} /></div>
                    </td>
                    <td className="small muted">{dt(b.createdAt)}</td>
                    <td className="small muted">{b.expiresAt ? dt(b.expiresAt) : '—'}</td>
                    <td><span className={`badge ${b.active ? 'good' : 'gray'}`}>{b.active ? 'Đang dùng' : 'Đã ngừng'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && <div className="a-empty">Chưa có lô mã nào — tạo lô mã hoặc tạo khi nhập kho.</div>}
          </div>
        </div>
      )}
      {creating && (
        <CreateDrawer
          open
          products={products}
          config={data?.config}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {open && (
        <BatchDrawer
          key={open._id}
          batch={open}
          onClose={() => setOpen(null)}
          onChanged={(b) => {
            setOpen(b);
            load();
          }}
        />
      )}
    </>
  );
}
