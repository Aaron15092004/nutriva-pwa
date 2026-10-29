import { Fragment, useState } from 'react';
import { Search, Trash2, KeyRound, Save, BadgeCheck } from 'lucide-react';
import { GOALS, ingredientName, computeHealth } from '@shared/nutrition.js';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote } from '../components/ui.jsx';
import { useApi } from '../lib/useApi.js';
import { useAdminList, useDebounced, Drawer, Pager, Field, NumInput, vnd, dt } from './kit.jsx';
import { LineChart } from './charts.jsx';

const EVENT_LABEL = {
  'app.open': 'Mở app (ngày)',
  'log.food': 'Ghi món ăn',
  'log.water': 'Ghi nước',
  'log.exercise': 'Ghi vận động',
  'assistant.ask': 'Hỏi Nuti',
  'order.place': 'Đặt hàng',
  'order.cancel': 'Hủy đơn',
  'plan.view': 'Xem kế hoạch',
  'shop.view': 'Xem cửa hàng',
  'assistant.open': 'Mở trợ lý',
  'user.signup': 'Đăng ký',
};
const PLATFORM = { android: 'Android', ios: 'iOS', desktop: 'Máy tính' };
const ago = (iso) => {
  if (!iso) return 'Chưa ghi nhận';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return 'Trong 1 giờ qua';
  if (m < 1440) return `${Math.round(m / 60)} giờ trước`;
  return `${Math.round(m / 1440)} ngày trước`;
};

const GRANT_SOURCE = { code: 'Nhập mã', order: 'Đơn hàng', admin: 'Admin tặng', migration: 'Chuyển đổi hệ thống', revoke: 'Thu hồi' };

// Gói thành viên: hạn dùng, lịch sử cộng / trừ ngày, cộng tay (tặng, bù lỗi…) có ghi lý do
function UserMembership({ id }) {
  const toast = useToast();
  const { data, reload } = useApi(`/admin/users/${id}/membership`);
  const [days, setDays] = useState(7);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const left = data.until ? Math.ceil((new Date(data.until) - Date.now()) / 86400000) : 0;
  const grant = async (sign) => {
    setBusy(true);
    try {
      await api.post(`/admin/users/${id}/membership`, { days: sign * Math.abs(days), note });
      toast(sign > 0 ? `Đã cộng ${Math.abs(days)} ngày` : `Đã trừ ${Math.abs(days)} ngày`);
      setNote('');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="a-card stack">
      <h3 className="title-sm row" style={{ gap: 6 }}><BadgeCheck size={16} /> Gói thành viên</h3>
      <p className="small">
        {left > 0 ? <><span className="badge good">Còn {left} ngày</span> đến {dt(data.until)}</> : <span className="badge gray">{data.until ? `Hết hạn ${dt(data.until)}` : 'Chưa kích hoạt'}</span>}
        <span className="muted"> • đã nhập {data.codes} mã</span>
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <NumInput style={{ width: 110 }} integer suffix="ngày" aria-label="Số ngày" value={days} invalid={!(days >= 1 && days <= 3650)} onChange={(v) => setDays(v ?? 0)} />
        <input className="a-input grow" style={{ minWidth: 200 }} maxLength={120} aria-label="Lý do" placeholder="Lý do (bắt buộc), vd: bù lỗi giao hàng" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-soft btn-sm" disabled={busy || !note.trim() || !(days >= 1 && days <= 3650)} onClick={() => grant(1)}>+ Cộng</button>
        <button className="btn btn-soft btn-sm" disabled={busy || !note.trim() || !(days >= 1 && days <= 3650) || left <= 0} onClick={() => window.confirm(`Trừ ${Math.abs(days)} ngày của người dùng này?`) && grant(-1)}>− Trừ</button>
      </div>
      {data.history.length > 0 && (
        <table className="a-table">
          <thead><tr><th>Thời gian</th><th>Nguồn</th><th className="num">Ngày</th><th>Ghi chú</th></tr></thead>
          <tbody>
            {data.history.map((g) => (
              <tr key={g._id} className="!cursor-default">
                <td className="xs muted whitespace-nowrap">{dt(g.createdAt)}</td>
                <td className="small">{GRANT_SOURCE[g.source] ?? g.source}</td>
                <td className={`num font-bold ${g.days > 0 ? 'text-brand-dark' : 'text-warm-dark'}`}>{g.days > 0 ? '+' : ''}{g.days}</td>
                <td className="xs">{g.note}{g.by ? <span className="muted"> • {g.by}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// Hoạt động của 1 người dùng: mức sử dụng, cân nặng, sự kiện 30 ngày, nhật ký thao tác liên quan
function UserActivity({ id }) {
  const { data, error, loading } = useApi(`/admin/insights/users/${id}`);
  if (loading && !data) return <p className="small muted">Đang tải hoạt động…</p>;
  if (error) return <ErrorNote error={error} />;
  const { stats: st, weights, events30, audit, subscriptions } = data;
  return (
    <>
      <section className="a-card">
        <h3 className="title-sm" style={{ marginBottom: 8 }}>Mức sử dụng</h3>
        <dl className="a-kv">
          <dt>Hoạt động gần nhất</dt><dd>{ago(data.user.lastActiveAt)}</dd>
          <dt>Thiết bị</dt><dd>{st.platforms.map((p) => PLATFORM[p] ?? p).join(', ') || '—'}</dd>
          <dt>Đăng nhập bằng</dt><dd>{data.user.googleId ? 'Google' : 'Email'}{data.user.googleId && data.user.hasPassword ? ' + mật khẩu' : ''}</dd>
          <dt>Nhật ký ăn uống</dt><dd>{st.logDays} ngày{st.lastLogDate ? ` • gần nhất ${st.lastLogDate}` : ''}</dd>
          <dt>Hỏi Nuti</dt><dd>{st.questions} câu{st.downvotes ? ` • ${st.downvotes} lần chê 👎` : ''}</dd>
          <dt>Gói định kỳ</dt><dd>{subscriptions.length ? subscriptions.map((x) => `${x.productName} ${x.bottles} chai/tuần${x.active ? '' : ' (tạm dừng)'}`).join('; ') : '—'}</dd>
          <dt>Kế hoạch đang theo</dt><dd>{data.user.activePlan?.plan ? `Từ ${data.user.activePlan.startDate}` : '—'}</dd>
        </dl>
      </section>
      {weights.length > 1 && (
        <section className="a-card">
          <h3 className="title-sm" style={{ marginBottom: 8 }}>Cân nặng ({weights[0].kg} → {weights[weights.length - 1].kg} kg)</h3>
          <LineChart caption="Cân nặng theo thời gian" height={140} data={weights.map((w) => ({ key: w.date, label: `${Number(w.date.slice(8))}/${Number(w.date.slice(5, 7))}`, value: w.kg }))} format={(v) => `${Math.round(v)}`} tipFormat={(v) => `${v} kg`} />
        </section>
      )}
      {events30.length > 0 && (
        <section className="a-card">
          <h3 className="title-sm" style={{ marginBottom: 8 }}>30 ngày qua</h3>
          <dl className="a-kv">
            {events30.map((e) => (
              <Fragment key={e.type}>
                <dt>{EVENT_LABEL[e.type] ?? e.type}</dt>
                <dd>{e.n} lần • gần nhất {dt(e.last)}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      )}
      <section className="a-card">
        <h3 className="title-sm" style={{ marginBottom: 8 }}>Nhật ký thao tác</h3>
        {!audit.length && <p className="small muted">Chưa có.</p>}
        <ul className="flex flex-col gap-1">
          {audit.map((a) => (
            <li key={a._id} className="flex gap-2 text-sm">
              <span className="w-32 shrink-0 text-xs text-muted">{dt(a.at)}</span>
              <span className={a.ok === false ? 'text-warm-dark' : ''}>
                {a.action}
                {a.actorEmail && a.actor !== id ? ` • bởi ${a.actorEmail}` : ''}
                {a.summary ? ` • ${a.summary}` : ''}
                <span className="text-xs text-muted"> • {a.ip}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function UserDrawer({ u, me, onClose, onSaved, onDeleted }) {
  const toast = useToast();
  const [name, setName] = useState(u.name);
  const [role, setRole] = useState(u.role);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const h = computeHealth(u.profile);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      title={u.email}
      onClose={onClose}
      footer={
        <>
          {String(u._id) !== String(me) && (
            <button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} disabled={busy}
              onClick={() => window.confirm(`Xóa vĩnh viễn ${u.email}? Dữ liệu cá nhân bị xóa; đơn hàng được giữ ở dạng ẩn danh.`) && run(async () => { await api.del(`/admin/users/${u._id}`); toast('Đã xóa người dùng'); onDeleted(u); })}>
              <Trash2 size={16} /> Xóa
            </button>
          )}
          <Button className="btn-primary btn-sm" loading={busy} onClick={() => run(async () => { const { item } = await api.patch(`/admin/users/${u._id}`, { name, role }); toast('Đã lưu'); onSaved({ ...u, ...item }); })}>
            <Save size={16} /> Lưu
          </Button>
        </>
      }
    >
      <div className="a-form">
        <Field label="Tên" htmlFor="un"><input id="un" className="a-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Vai trò" htmlFor="ur">
          <select id="ur" className="a-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">Người dùng</option>
            <option value="admin">Quản trị viên</option>
          </select>
        </Field>
      </div>
      <section className="a-card">
        <dl className="a-kv">
          <dt>Tham gia</dt><dd>{dt(u.createdAt)}</dd>
          <dt>Đơn hàng</dt><dd>{u.orders} đơn • {vnd(u.spent)}</dd>
          <dt>Cơ thể</dt><dd>{u.profile.gender === 'male' ? 'Nam' : 'Nữ'}, {u.profile.age} tuổi{u.profile.birthYear ? ` (sinh ${u.profile.birthYear})` : ''}, {u.profile.heightCm} cm, {u.profile.weightKg} kg, eo {u.profile.waistCm} cm{u.profile.waistEstimated ? ' (ước tính)' : ''}</dd>
          <dt>Chỉ số</dt><dd>BMI {h?.bmi} • TDEE {h?.tdee} kcal • Mục tiêu {h?.targetKcal} kcal</dd>
          <dt>Mục tiêu</dt><dd>{GOALS.find((g) => g.id === u.profile.goal)?.label}</dd>
          <dt>Cần tránh</dt><dd>{u.profile.allergies?.length ? u.profile.allergies.map(ingredientName).join(', ') : 'Không'}</dd>
          <dt>Lưu ý sức khỏe</dt><dd>{u.profile.healthNote || '—'}</dd>
          <dt>Địa chỉ</dt><dd>{[u.address?.name, u.address?.phone, u.address?.line].filter(Boolean).join(' • ') || '—'}</dd>
        </dl>
      </section>
      <UserMembership id={u._id} />
      <UserActivity id={u._id} />
      <section className="a-card stack">
        <h3 className="title-sm row" style={{ gap: 6 }}><KeyRound size={16} /> Đặt lại mật khẩu</h3>
        <p className="xs muted">Người dùng sẽ bị đăng xuất khỏi mọi thiết bị.</p>
        <div className="row" style={{ gap: 8 }}>
          <input className="a-input grow" type="text" aria-label="Mật khẩu mới" placeholder="Mật khẩu mới (≥ 6 ký tự)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn btn-soft btn-sm" disabled={busy || pw.length < 6} onClick={() => run(async () => { await api.post(`/admin/users/${u._id}/password`, { password: pw }); setPw(''); toast('Đã đặt lại mật khẩu'); })}>Đặt lại</button>
        </div>
      </section>
      <ErrorNote error={error} />
    </Drawer>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const list = useAdminList('/admin/users', { q: search, role, page, limit: 30 });
  const [open, setOpen] = useState(null);

  return (
    <>
      <div className="admin-head"><h1>Người dùng</h1></div>
      <div className="a-toolbar">
        <div className="input-wrap a-search" style={{ minHeight: 40 }}>
          <Search size={18} />
          <input aria-label="Tìm người dùng" placeholder="Email hoặc tên" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ height: 38, fontSize: 14, fontWeight: 500 }} />
        </div>
        <select className="a-select" aria-label="Vai trò" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">Vai trò: tất cả</option>
          <option value="user">Người dùng</option>
          <option value="admin">Quản trị viên</option>
        </select>
      </div>
      <ErrorNote error={list.error} />
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Người dùng</th><th>Mục tiêu</th><th className="num">Đơn</th><th className="num">Chi tiêu</th><th>Vai trò</th><th>Hoạt động</th><th>Tham gia</th></tr></thead>
          <tbody>
            {list.items.map((u) => (
              <tr key={u._id} onClick={() => setOpen(u)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(u)}>
                <td><b>{u.name}</b><div className="xs muted">{u.email}</div></td>
                <td>{GOALS.find((g) => g.id === u.profile?.goal)?.label}</td>
                <td className="num">{u.orders}</td>
                <td className="num">{vnd(u.spent)}</td>
                <td><span className={`badge ${u.role === 'admin' ? 'warn' : 'gray'}`}>{u.role === 'admin' ? 'Admin' : 'User'}</span></td>
                <td className="small muted">{ago(u.lastActiveAt)}</td>
                <td className="small muted">{dt(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !list.items.length && <div className="a-empty">Không có người dùng.</div>}
      </div>
      <Pager page={page} limit={30} total={list.total} onPage={setPage} />
      {open && (
        <UserDrawer
          key={open._id}
          u={open}
          me={user.id}
          onClose={() => setOpen(null)}
          onSaved={(u) => { list.setItems((items) => items.map((x) => (x._id === u._id ? u : x))); setOpen(null); }}
          onDeleted={(u) => { list.setItems((items) => items.filter((x) => x._id !== u._id)); setOpen(null); }}
        />
      )}
    </>
  );
}
