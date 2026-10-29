import { Fragment, useEffect, useState } from 'react';
import { Search, ShieldAlert, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { ErrorNote, Skeleton } from '../components/ui.jsx';
import { useDebounced, dt } from './kit.jsx';

// Tên dễ đọc cho các thao tác hay gặp; còn lại hiện mã gốc
const ACTION_LABEL = {
  'auth.login': 'Đăng nhập',
  'auth.login_failed': 'Đăng nhập sai',
  'auth.register': 'Đăng ký',
  'auth.password_change': 'Đổi mật khẩu',
  'auth.password_reset_request': 'Yêu cầu quên mật khẩu',
  'auth.password_reset': 'Đặt lại mật khẩu (email)',
  'auth.logout_all': 'Đăng xuất mọi thiết bị',
  'auth.delete_account': 'Tự xóa tài khoản',
  'user.update': 'Admin sửa người dùng',
  'user.password_reset': 'Admin đặt lại mật khẩu',
  'user.delete': 'Admin xóa người dùng',
  'order.update': 'Cập nhật đơn hàng',
  'settings.update': 'Sửa cấu hình',
  'subscription.pause': 'Tạm dừng gói định kỳ',
  'subscription.resume': 'Bật lại gói định kỳ',
  'subscription.run': 'Chạy tạo đơn định kỳ',
  'subscription.generate_failed': 'Lỗi tạo đơn định kỳ',
  'support.reply': 'Trả lời hỗ trợ',
  'support.update': 'Cập nhật hỗ trợ',
  'file.upload': 'Tải ảnh lên',
};
const VERB = { create: 'Tạo', update: 'Sửa', delete: 'Xóa' };
const ENTITY = { product: 'sản phẩm', food: 'thực phẩm', dish: 'món ăn', mealplan: 'kế hoạch mẫu', activity: 'hoạt động', coupon: 'mã giảm giá' };
const labelOf = (a) => {
  if (ACTION_LABEL[a]) return ACTION_LABEL[a];
  const [e, v] = a.split('.');
  return VERB[v] && ENTITY[e] ? `${VERB[v]} ${ENTITY[e]}` : a;
};
const GROUPS = [
  { id: '', label: 'Tất cả thao tác' },
  { id: 'auth.', label: 'Đăng nhập & tài khoản' },
  { id: 'user.', label: 'Admin quản lý người dùng' },
  { id: 'order.', label: 'Đơn hàng' },
];
const show = (v) => (v == null || v === '' ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function SecurityPanel() {
  const { data } = useApi('/admin/insights/security');
  if (!data) return null;
  const risky = data.failedByIp.filter((x) => x.n >= 5);
  return (
    <section className="a-card flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-primary">
        <ShieldAlert size={18} className="text-warm-dark" aria-hidden="true" /> Bảo mật 24 giờ qua
      </h2>
      <p className="text-sm text-secondary">
        Đăng nhập sai: {data.failedByIp.reduce((a, x) => a + x.n, 0)} lần từ {data.failedByIp.length} IP • Đặt lại mật khẩu: {data.passwordResets} • Xóa tài khoản: {data.accountDeletes}
      </p>
      {risky.length > 0 && (
        <p className="rounded-lg bg-error px-4 py-2 text-sm text-warm-dark">
          Nghi dò mật khẩu: {risky.map((x) => `${x._id} (${x.n} lần)`).join(', ')}. Hệ thống tự chặn IP sai quá 10 lần/15 phút.
        </p>
      )}
      {data.failedByEmail.length > 0 && (
        <p className="text-xs text-muted">Tài khoản bị nhập sai nhiều nhất: {data.failedByEmail.slice(0, 5).map((x) => `${x._id} (${x.n})`).join(', ')}</p>
      )}
    </section>
  );
}

// Nhật ký thao tác: ai làm gì, trên dữ liệu nào, lúc nào, từ IP nào — kèm các trường đã thay đổi
export default function Audit() {
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState([]);
  const [actions, setActions] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const search = useDebounced(q);

  const load = async (before) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams(Object.entries({ q: search, action, ok: failed ? 'false' : '', before: before ?? '', limit: 50 }).filter(([, v]) => v !== '')).toString();
      const d = await api.get(`/admin/insights/audit?${qs}`);
      setItems((cur) => (before ? [...cur, ...d.items] : d.items));
      setActions(d.actions);
      setNext(d.next);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, action, failed]);

  return (
    <>
      <div className="admin-head"><h1>Nhật ký thao tác</h1></div>
      <div className="flex flex-col gap-4">
        <SecurityPanel />
        <div className="a-toolbar !mb-0">
          <label className="a-input a-search inline-flex items-center gap-2">
            <Search size={16} className="text-subtle" aria-hidden="true" />
            <input aria-label="Tìm trong nhật ký" placeholder="Email, IP, mã đơn, nội dung…" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          <select className="a-select" aria-label="Loại thao tác" value={action} onChange={(e) => setAction(e.target.value)}>
            {GROUPS.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
            <optgroup label="Thao tác cụ thể">
              {actions.map((a) => (
                <option key={a} value={a}>{labelOf(a)}</option>
              ))}
            </optgroup>
          </select>
          <label className="a-check">
            <input type="checkbox" checked={failed} onChange={(e) => setFailed(e.target.checked)} /> Chỉ thao tác thất bại
          </label>
        </div>
        <ErrorNote error={error} />
        {loading && !items.length ? (
          <Skeleton h={360} />
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th aria-label="Mở rộng" />
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Thao tác</th>
                  <th>Đối tượng</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const expanded = open === it._id;
                  const hasChanges = it.changes && Object.keys(it.changes).length > 0;
                  return (
                    <Fragment key={it._id}>
                      <tr onClick={() => setOpen(expanded ? null : it._id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(expanded ? null : it._id)} aria-expanded={expanded}>
                        <td className="w-8 text-subtle">{hasChanges || it.ua ? expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} /> : null}</td>
                        <td className="whitespace-nowrap text-sm text-muted">{dt(it.at)}</td>
                        <td>
                          <span className="block text-sm font-semibold">{it.actorEmail ?? 'Hệ thống'}</span>
                          {it.actorRole && <span className="text-xs text-muted">{it.actorRole}</span>}
                        </td>
                        <td>
                          <span className={`badge ${it.ok === false ? 'warn' : 'gray'}`}>{labelOf(it.action)}</span>
                        </td>
                        <td className="max-w-xs truncate text-sm">{it.summary ?? (it.entity ? `${it.entity} ${it.entityId ?? ''}` : '—')}</td>
                        <td className="whitespace-nowrap font-mono text-xs text-muted">{it.ip || '—'}</td>
                      </tr>
                      {expanded && (
                        <tr className="!cursor-default bg-background">
                          <td />
                          <td colSpan={5}>
                            {hasChanges && (
                              <dl className="mb-2 grid grid-cols-[160px_1fr] gap-x-4 gap-y-1 text-sm">
                                {Object.entries(it.changes).map(([k, [a, b]]) => (
                                  <Fragment key={k}>
                                    <dt className="font-mono text-xs text-muted">{k}</dt>
                                    <dd className="m-0 break-all">
                                      <span className="text-muted line-through">{show(a)}</span> → <b>{show(b)}</b>
                                    </dd>
                                  </Fragment>
                                ))}
                              </dl>
                            )}
                            <p className="text-xs text-muted">
                              {it.action} • {it.entity ?? ''} {it.entityId ?? ''} • {it.ua || 'không rõ thiết bị'}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!loading && !items.length && <div className="a-empty">Không có thao tác nào khớp bộ lọc.</div>}
          </div>
        )}
        {next && (
          <button type="button" className="a-select self-center" disabled={loading} onClick={() => load(next)}>
            {loading ? 'Đang tải…' : 'Xem cũ hơn'}
          </button>
        )}
      </div>
    </>
  );
}
