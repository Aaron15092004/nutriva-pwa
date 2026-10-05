import { useState } from 'react';
import { Search, Trash2, KeyRound, Save } from 'lucide-react';
import { GOALS, ingredientName, computeHealth } from '@shared/nutrition.js';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote } from '../components/ui.jsx';
import { useAdminList, useDebounced, Drawer, Pager, Field, vnd, dt } from './kit.jsx';

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
              onClick={() => window.confirm(`Xóa vĩnh viễn ${u.email} và toàn bộ dữ liệu?`) && run(async () => { await api.del(`/admin/users/${u._id}`); toast('Đã xóa người dùng'); onDeleted(u); })}>
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
          <dt>Cơ thể</dt><dd>{u.profile.gender === 'male' ? 'Nam' : 'Nữ'}, {u.profile.age} tuổi, {u.profile.heightCm} cm, {u.profile.weightKg} kg, eo {u.profile.waistCm} cm</dd>
          <dt>Chỉ số</dt><dd>BMI {h?.bmi} • TDEE {h?.tdee} kcal • Mục tiêu {h?.targetKcal} kcal</dd>
          <dt>Mục tiêu</dt><dd>{GOALS.find((g) => g.id === u.profile.goal)?.label}</dd>
          <dt>Cần tránh</dt><dd>{u.profile.allergies?.length ? u.profile.allergies.map(ingredientName).join(', ') : 'Không'}</dd>
          <dt>Lưu ý sức khỏe</dt><dd>{u.profile.healthNote || '—'}</dd>
          <dt>Địa chỉ</dt><dd>{[u.address?.name, u.address?.phone, u.address?.line].filter(Boolean).join(' • ') || '—'}</dd>
        </dl>
      </section>
      <section className="a-card stack">
        <h3 className="title-sm row" style={{ gap: 6 }}><KeyRound size={16} /> Đặt lại mật khẩu</h3>
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
          <thead><tr><th>Người dùng</th><th>Mục tiêu</th><th className="num">Đơn</th><th className="num">Chi tiêu</th><th>Vai trò</th><th>Tham gia</th></tr></thead>
          <tbody>
            {list.items.map((u) => (
              <tr key={u._id} onClick={() => setOpen(u)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(u)}>
                <td><b>{u.name}</b><div className="xs muted">{u.email}</div></td>
                <td>{GOALS.find((g) => g.id === u.profile?.goal)?.label}</td>
                <td className="num">{u.orders}</td>
                <td className="num">{vnd(u.spent)}</td>
                <td><span className={`badge ${u.role === 'admin' ? 'warn' : 'gray'}`}>{u.role === 'admin' ? 'Admin' : 'User'}</span></td>
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
