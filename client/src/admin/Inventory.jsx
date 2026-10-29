import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackagePlus, ClipboardCheck, Trash2, Download, AlertTriangle, PackageX, CalendarClock, Boxes } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote, Skeleton } from '../components/ui.jsx';
import { Drawer, Field, Pager, dt, vnd, downloadFile, ymd, plusDays } from './kit.jsx';
import { StatTile } from './charts.jsx';
import { productTypeOf, productTitle } from '@shared/nutrition.js';

const n = (v) => (v ?? 0).toLocaleString('vi-VN');
const TYPE = { import: 'Nhập kho', sale: 'Bán', return: 'Hoàn (hủy đơn)', adjust: 'Kiểm kê', waste: 'Xuất hủy' };
const STATUS = { ok: ['Đủ hàng', 'good'], low: ['Sắp hết', 'warn'], out: ['Hết hàng', 'bad'], untracked: ['Chưa quản lý', 'gray'] };
const SHELF_DAYS = { milk: 3, diy: 90, treat: 7 }; // hạn dùng gợi ý khi nhập kho
const WASTE_REASONS = ['Hết hạn', 'Hỏng / móp chai', 'Dùng thử / tặng khách', 'Thất lạc', 'Khác'];

function expiryBadge(date, today) {
  if (!date) return null;
  if (date < today) return <span className="badge bad">Quá hạn {date.slice(8)}/{date.slice(5, 7)}</span>;
  if (date <= plusDays(today, 2)) return <span className="badge warn">HSD {date.slice(8)}/{date.slice(5, 7)}</span>;
  return <span className="badge gray">HSD {date.slice(8)}/{date.slice(5, 7)}</span>;
}

// Phiếu nhập kho / kiểm kê / xuất hủy
function ActionDrawer({ kind, product, lots, onClose, onDone }) {
  const toast = useToast();
  const today = ymd();
  const [f, setF] = useState({
    qty: kind === 'adjust' ? product.stock ?? 0 : 10,
    lotCode: '',
    mfgDate: today,
    expiryDate: plusDays(today, SHELF_DAYS[product.type] ?? 7),
    cost: '',
    note: kind === 'waste' ? WASTE_REASONS[0] : '',
    lot: '',
    codes: kind === 'receive' && product.type !== 'treat',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const title = { receive: 'Nhập kho', adjust: 'Kiểm kê', waste: 'Xuất hủy' }[kind];
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (kind === 'receive') {
        const r = await api.post('/admin/inventory/receive', { product: product._id, qty: f.qty, lotCode: f.lotCode, mfgDate: f.mfgDate, expiryDate: f.expiryDate, cost: f.cost, note: f.note, codes: f.codes });
        toast(`Đã nhập ${f.qty} • tồn ${r.stock}`);
        if (r.batch) return setResult(r);
      } else if (kind === 'adjust') {
        const r = await api.post('/admin/inventory/adjust', { product: product._id, actual: f.qty, note: f.note });
        toast(r.diff ? `Đã điều chỉnh ${r.diff > 0 ? '+' : ''}${r.diff}` : 'Tồn kho khớp, không thay đổi');
      } else {
        await api.post('/admin/inventory/waste', { product: product._id, qty: f.qty, lot: f.lot || undefined, note: f.note });
        toast(`Đã xuất hủy ${f.qty}`);
      }
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer
      open
      title={`${title} — ${productTitle(product)}`}
      onClose={result ? onDone : onClose}
      footer={
        result ? (
          <>
            <button className="btn btn-soft btn-sm" onClick={onDone}>Xong</button>
            <Link className="btn btn-primary btn-sm" to={`/admin/activation/${result.batch._id}/print`} target="_blank">In {result.batch.quantity} tem mã</Link>
          </>
        ) : (
          <Button className="btn-primary btn-sm" loading={busy} onClick={submit}>{title}</Button>
        )
      }
    >
      {result ? (
        <p className="small">Đã nhập lô <b>{result.lot.code}</b> và tạo <b>{result.batch.quantity}</b> mã kích hoạt (+{result.batch.days} ngày/mã). In tem và dán lên từng {product.type === 'diy' ? 'gói' : 'chai'} trước khi bán.</p>
      ) : (
        <>
          <p className="small muted">{productTypeOf(product.type).label} • tồn hiện tại: <b>{product.stock == null ? 'chưa quản lý' : n(product.stock)}</b></p>
          <div className="a-form">
            <Field label={kind === 'adjust' ? 'Số đếm thực tế' : 'Số lượng'} htmlFor="iv-q">
              <input id="iv-q" className="a-input" type="number" min="0" value={f.qty} onChange={(e) => set({ qty: Number(e.target.value) })} />
            </Field>
            {kind === 'receive' && (
              <>
                <Field label="Mã lô" htmlFor="iv-l" hint="Trống = tự sinh (LO-YYMMDD-xxx)"><input id="iv-l" className="a-input" maxLength={40} value={f.lotCode} onChange={(e) => set({ lotCode: e.target.value })} /></Field>
                <Field label="Ngày sản xuất" htmlFor="iv-m"><input id="iv-m" className="a-input" type="date" value={f.mfgDate} onChange={(e) => set({ mfgDate: e.target.value })} /></Field>
                <Field label="Hạn dùng" htmlFor="iv-e" hint={`Gợi ý: ${SHELF_DAYS[product.type] ?? 7} ngày sau ngày sản xuất`}><input id="iv-e" className="a-input" type="date" value={f.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} /></Field>
                <Field label="Giá vốn / đơn vị (đ)" htmlFor="iv-c"><input id="iv-c" className="a-input" type="number" min="0" step="500" value={f.cost} onChange={(e) => set({ cost: e.target.value })} /></Field>
                {product.type !== 'treat' && (
                  <Field label="Mã kích hoạt" full htmlFor="iv-k">
                    <label className="a-check"><input id="iv-k" type="checkbox" checked={f.codes} onChange={(e) => set({ codes: e.target.checked })} /> Tạo {f.qty} mã kích hoạt cho lô này (in tem QR dán lên từng {product.type === 'diy' ? 'gói' : 'chai'})</label>
                  </Field>
                )}
              </>
            )}
            {kind === 'waste' && (
              <>
                <Field label="Lý do" htmlFor="iv-r">
                  <select id="iv-r" className="a-select" value={f.note} onChange={(e) => set({ note: e.target.value })}>
                    {WASTE_REASONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Lô (tùy chọn)" htmlFor="iv-lt" hint="Trống = trừ lô gần hết hạn trước">
                  <select id="iv-lt" className="a-select" value={f.lot} onChange={(e) => set({ lot: e.target.value })}>
                    <option value="">Tự chọn theo hạn dùng</option>
                    {lots.map((l) => <option key={l._id} value={l._id}>{l.code} • còn {l.remaining}{l.expiryDate ? ` • HSD ${l.expiryDate}` : ''}</option>)}
                  </select>
                </Field>
              </>
            )}
            {kind !== 'waste' && (
              <Field label="Ghi chú" full htmlFor="iv-n"><input id="iv-n" className="a-input" maxLength={200} value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder={kind === 'adjust' ? 'vd: Kiểm kê cuối ngày' : 'vd: Nhập từ xưởng'} /></Field>
            )}
          </div>
          <ErrorNote error={error} />
        </>
      )}
    </Drawer>
  );
}

// Ngưỡng "sắp hết": sửa tại chỗ, lưu khi rời ô
function LowStockInput({ product, onSaved }) {
  const toast = useToast();
  const [v, setV] = useState(product.lowStock ?? 10);
  const save = async () => {
    if (Number(v) === (product.lowStock ?? 10)) return;
    try {
      await api.patch(`/admin/inventory/${product._id}`, { lowStock: v });
      toast(`Cảnh báo khi còn ≤ ${v}`);
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
      setV(product.lowStock ?? 10);
    }
  };
  return (
    <label className="xs muted inline-flex items-center gap-1">
      cảnh báo ≤
      <input type="number" min="0" className="w-14 rounded border border-border px-1 text-right" aria-label={`Ngưỡng sắp hết của ${product.name}`} value={v} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
    </label>
  );
}

function StockTab({ data, onAction, onReload }) {
  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <thead><tr><th /><th>Sản phẩm</th><th className="num">Tồn kho</th><th className="num">Bán 7 ngày</th><th className="num">TB / ngày</th><th className="num">Đủ bán</th><th>Lô gần hết hạn</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>
          {data.items.map((p) => (
            <tr key={p._id} className="!cursor-default">
              <td>{p.image && <img src={p.image} alt="" />}</td>
              <td><b>{p.name}</b><div className="xs muted">{productTypeOf(p.type).short}{p.active ? '' : ' • đang tắt'}</div></td>
              <td className="num"><b className={p.status === 'out' ? 'text-warm-dark' : p.status === 'low' ? 'text-cookie' : ''}>{p.stock == null ? '∞' : n(p.stock)}</b><div><LowStockInput product={p} onSaved={onReload} /></div></td>
              <td className="num">{n(p.sold7)}</td>
              <td className="num">{p.perDay ? String(p.perDay).replace('.', ',') : '—'}</td>
              <td className="num">{p.coverDays == null ? '—' : `${n(p.coverDays)} ngày`}</td>
              <td>{p.nextLot ? <span className="flex flex-col items-start gap-1 text-xs"><span className="font-mono">{p.nextLot}</span>{expiryBadge(p.nextExpiry, data.today)}</span> : <span className="xs muted">—</span>}</td>
              <td><span className={`badge ${STATUS[p.status][1]}`}>{STATUS[p.status][0]}</span></td>
              <td className="num whitespace-nowrap">
                <button className="icon-btn" title="Nhập kho" aria-label={`Nhập kho ${p.name}`} onClick={() => onAction('receive', p)}><PackagePlus size={18} /></button>
                <button className="icon-btn" title="Kiểm kê" aria-label={`Kiểm kê ${p.name}`} onClick={() => onAction('adjust', p)}><ClipboardCheck size={18} /></button>
                <button className="icon-btn" title="Xuất hủy" aria-label={`Xuất hủy ${p.name}`} disabled={!p.stock} onClick={() => onAction('waste', p)}><Trash2 size={18} color="var(--danger)" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LotsTab({ onWaste }) {
  const [data, setData] = useState(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    api.get(`/admin/inventory/lots${all ? '?all=1' : ''}`).then(setData).catch(() => {});
  }, [all]);
  if (!data) return <Skeleton h={240} />;
  return (
    <div className="flex flex-col gap-2">
      <label className="a-check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Hiện cả lô đã hết hàng</label>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Lô</th><th>Sản phẩm</th><th className="num">Nhập</th><th className="num">Còn</th><th>NSX</th><th>Hạn dùng</th><th className="num">Giá vốn</th><th>Nhập bởi</th><th /></tr></thead>
          <tbody>
            {data.items.map((l) => (
              <tr key={l._id} className="!cursor-default">
                <td className="font-mono text-sm">{l.code}</td>
                <td>{l.product && productTitle(l.product)}</td>
                <td className="num">{n(l.qty)}</td>
                <td className="num"><b>{n(l.remaining)}</b></td>
                <td className="small">{l.mfgDate ?? '—'}</td>
                <td>{expiryBadge(l.expiryDate, data.today) ?? '—'}</td>
                <td className="num">{l.cost ? vnd(l.cost) : '—'}</td>
                <td className="small muted">{l.createdBy}<div>{dt(l.createdAt)}</div></td>
                <td className="num">{l.remaining > 0 && <button className="icon-btn" aria-label={`Xuất hủy lô ${l.code}`} onClick={() => onWaste(l)}><Trash2 size={16} color="var(--danger)" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.items.length && <div className="a-empty">Chưa có lô hàng — bấm Nhập kho ở tab Tồn kho.</div>}
      </div>
    </div>
  );
}

function MovesTab({ products }) {
  const toast = useToast();
  const [f, setF] = useState({ product: '', type: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const qs = new URLSearchParams(Object.entries({ ...f, page, limit: 50 }).filter(([, v]) => v)).toString();
  useEffect(() => {
    api.get(`/admin/inventory/moves?${qs}`).then(setData).catch(() => {});
  }, [qs]);
  const set = (p) => {
    setF((x) => ({ ...x, ...p }));
    setPage(1);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="a-toolbar !mb-0">
        <select className="a-select" aria-label="Sản phẩm" value={f.product} onChange={(e) => set({ product: e.target.value })}>
          <option value="">Tất cả sản phẩm</option>
          {products.map((p) => <option key={p._id} value={p._id}>{productTitle(p)}</option>)}
        </select>
        <select className="a-select" aria-label="Loại phiếu" value={f.type} onChange={(e) => set({ type: e.target.value })}>
          <option value="">Mọi loại phiếu</option>
          {Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="a-input" type="date" aria-label="Từ ngày" value={f.from} onChange={(e) => set({ from: e.target.value })} />
        <input className="a-input" type="date" aria-label="Đến ngày" value={f.to} onChange={(e) => set({ to: e.target.value })} />
        <button className="btn btn-soft btn-sm" onClick={() => downloadFile(`/admin/inventory/moves?format=csv&${qs}`, `xuat-nhap-kho-${ymd()}.csv`).catch((e) => toast(e.message, 'error'))}><Download size={16} /> Tải CSV</button>
      </div>
      {!data ? (
        <Skeleton h={240} />
      ) : (
        <>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Thời gian</th><th>Sản phẩm</th><th>Phiếu</th><th className="num">Số lượng</th><th className="num">Tồn sau</th><th>Lô</th><th>Ghi chú</th><th>Người thực hiện</th></tr></thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m._id} className="!cursor-default">
                    <td className="small muted whitespace-nowrap">{dt(m.createdAt)}</td>
                    <td>{m.product && productTitle(m.product)}</td>
                    <td><span className={`badge ${m.qty > 0 ? 'good' : m.type === 'waste' ? 'bad' : 'gray'}`}>{TYPE[m.type]}</span></td>
                    <td className={`num font-bold ${m.qty > 0 ? 'text-brand-dark' : 'text-warm-dark'}`}>{m.qty > 0 ? '+' : ''}{n(m.qty)}</td>
                    <td className="num">{m.stockAfter ?? '—'}</td>
                    <td className="small font-mono">{m.lot?.code ?? (m.lots?.length ? `${m.lots.length} lô` : '—')}</td>
                    <td className="small">{m.order?.code ?? m.note}</td>
                    <td className="small muted">{m.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && <div className="a-empty">Chưa có phiếu xuất nhập.</div>}
          </div>
          <Pager page={page} limit={50} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// Quản lý kho: tồn kho + tốc độ bán, lô hàng & hạn dùng, phiếu nhập / kiểm kê / xuất hủy
export default function Inventory() {
  const [tab, setTab] = useState('stock');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null); // { kind, product }
  const [lots, setLots] = useState([]);
  const load = () => api.get('/admin/inventory').then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const open = async (kind, product) => {
    if (kind === 'waste') setLots((await api.get(`/admin/inventory/lots?product=${product._id}`)).items);
    setAction({ kind, product });
  };
  const wasteLot = (l) => {
    const product = data.items.find((p) => p._id === (l.product?._id ?? l.product));
    if (product) open('waste', product);
  };
  const a = data?.alerts;
  return (
    <>
      <div className="admin-head"><h1>Kho hàng</h1></div>
      <ErrorNote error={error} />
      {!data ? (
        <Skeleton h={360} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="a-grid-4">
            <StatTile label={<span className="inline-flex items-center gap-1"><PackageX size={14} /> Hết hàng</span>} value={n(a.out)} tone={a.out ? 'bad' : undefined} sub="Sản phẩm đang quản lý tồn = 0" />
            <StatTile label={<span className="inline-flex items-center gap-1"><AlertTriangle size={14} /> Sắp hết</span>} value={n(a.low)} tone={a.low ? 'bad' : undefined} sub="Dưới ngưỡng cảnh báo" />
            <StatTile label={<span className="inline-flex items-center gap-1"><CalendarClock size={14} /> Sắp hết hạn (≤ 2 ngày)</span>} value={n(a.expiring)} tone={a.expiring ? 'bad' : undefined} sub="Số chai / gói nên bán trước hoặc khuyến mãi" />
            <StatTile label={<span className="inline-flex items-center gap-1"><Boxes size={14} /> Lô quá hạn còn tồn</span>} value={n(a.expiredLots)} tone={a.expiredLots ? 'bad' : undefined} sub="Cần xuất hủy" />
          </div>
          <div className="a-chips" role="group" aria-label="Chế độ xem">
            {[['stock', 'Tồn kho'], ['lots', 'Lô hàng & hạn dùng'], ['moves', 'Lịch sử xuất nhập']].map(([id, label]) => (
              <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          {tab === 'stock' && <StockTab data={data} onAction={open} onReload={load} />}
          {tab === 'lots' && <LotsTab onWaste={wasteLot} />}
          {tab === 'moves' && <MovesTab products={data.items} />}
        </div>
      )}
      {action && (
        <ActionDrawer
          key={`${action.kind}-${action.product._id}`}
          kind={action.kind}
          product={action.product}
          lots={lots}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            load();
          }}
        />
      )}
    </>
  );
}
