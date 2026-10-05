import { useState } from 'react';
import { Plus, Search, Trash2, Save } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote } from '../components/ui.jsx';
import { useAdminList, useDebounced, Drawer, Pager, Field, ImageInput, ChipsInput, StepsInput, VariantsInput, IngredientsInput, MicrosInput, JsonInput } from './kit.jsx';

// Trang CRUD chung, cấu hình bằng `config` (xem resources.js)
function FieldInput({ f, value, onChange }) {
  const id = `f-${f.key}`;
  switch (f.type) {
    case 'number':
      return <input id={id} className="a-input" type="number" step={f.step ?? 'any'} min={f.min} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'textarea':
      return <textarea id={id} className="a-textarea" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <select id={id} className="a-select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {f.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      );
    case 'chips':
      return <ChipsInput options={f.options} value={value ?? []} onChange={onChange} />;
    case 'checkbox':
      return (
        <label className="a-check"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {f.checkLabel ?? 'Bật'}</label>
      );
    case 'image':
      return <ImageInput id={id} value={value} onChange={onChange} />;
    case 'list':
      return <input id={id} className="a-input" value={(value ?? []).join(', ')} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />;
    case 'steps':
      return <StepsInput value={value ?? []} onChange={onChange} />;
    case 'credit':
      return (
        <div className="grid-2">
          {[['author', 'Tác giả'], ['license', 'Giấy phép (vd: CC BY-SA 4.0)'], ['source', 'Link trang ảnh gốc'], ['licenseUrl', 'Link giấy phép']].map(([k, ph]) => (
            <input key={k} className="a-input" aria-label={ph} placeholder={ph} value={value?.[k] ?? ''} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
          ))}
        </div>
      );
    case 'micros':
      return <MicrosInput value={value ?? {}} onChange={onChange} readOnly={f.readOnly} />;
    case 'json':
      return <JsonInput value={value} onChange={onChange} />;
    case 'ingredients':
      return <IngredientsInput value={value ?? []} onChange={onChange} />;
    case 'variants':
      return <VariantsInput value={value ?? []} onChange={onChange} />;
    case 'datetime':
      return <input id={id} className="a-input" type="datetime-local" value={value ? new Date(new Date(value).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />;
    case 'nutrition':
      return (
        <div className="grid-4">
          {[['kcal', 'kcal'], ['protein', 'Đạm g'], ['carb', 'Bột đường g'], ['fat', 'Béo g']].map(([k, l]) => (
            <label key={k} className="stack" style={{ gap: 2 }}>
              <span className="xs muted">{l}</span>
              <input className="a-input" type="number" step="any" min="0" value={value?.[k] ?? ''} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
      );
    default:
      return <input id={id} className="a-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

// Trường có `show(form)` chỉ hiện (và chỉ gửi đi) khi điều kiện đúng
const visible = (fields, form) => fields.filter((f) => !f.show || f.show(form));

export default function ResourcePage({ config }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const list = useAdminList(config.path, { q: search, page, limit: 30, ...filters });
  const [editing, setEditing] = useState(null); // { id?, form }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const open = (item) => {
    setError('');
    setEditing(item ? { id: item._id, form: { ...item } } : { form: { ...config.defaults } });
  };
  const set = (key, v) => setEditing((e) => ({ ...e, form: { ...e.form, [key]: v } }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body = Object.fromEntries(visible(config.fields, editing.form).filter((f) => !f.readOnly).map((f) => [f.key, editing.form[f.key]]));
      if (editing.id) await api.patch(`${config.path}/${editing.id}`, body);
      else await api.post(config.path, body);
      toast(editing.id ? 'Đã lưu thay đổi' : `Đã thêm ${config.singular}`);
      setEditing(null);
      list.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Xóa ${config.singular} này? Thao tác không thể hoàn tác.`)) return;
    try {
      await api.del(`${config.path}/${editing.id}`);
      toast(`Đã xóa ${config.singular}`);
      setEditing(null);
      list.reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="admin-head">
        <h1>{config.title}</h1>
        <button className="btn btn-primary btn-sm" onClick={() => open(null)}><Plus size={18} /> Thêm {config.singular}</button>
      </div>

      <div className="a-toolbar">
        <div className="input-wrap a-search" style={{ minHeight: 40 }}>
          <Search size={18} />
          <input aria-label="Tìm kiếm" placeholder="Tìm kiếm…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ height: 38, fontSize: 14, fontWeight: 500 }} />
        </div>
        {config.filters?.map((f) => (
          <select key={f.key} className="a-select" aria-label={f.label} value={filters[f.key] ?? ''} onChange={(e) => { setFilters({ ...filters, [f.key]: e.target.value }); setPage(1); }}>
            <option value="">{f.label}: tất cả</option>
            {f.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        ))}
      </div>

      <ErrorNote error={list.error} />
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>{config.columns.map((c) => <th key={c.key} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {list.items.map((it) => (
              <tr key={it._id} onClick={() => open(it)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(it)}>
                {config.columns.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(it) : String(it[c.key] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !list.items.length && <div className="a-empty">Không có dữ liệu.</div>}
        {list.loading && !list.items.length && <div className="a-empty">Đang tải…</div>}
      </div>
      <Pager page={page} limit={30} total={list.total} onPage={setPage} />

      <Drawer
        open={Boolean(editing)}
        title={editing?.id ? `Sửa ${config.singular}` : `Thêm ${config.singular}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            {editing?.id && <button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={remove}><Trash2 size={16} /> Xóa</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Hủy</button>
            <Button className="btn-primary btn-sm" loading={saving} onClick={save}><Save size={16} /> Lưu</Button>
          </>
        }
      >
        {editing && (
          <div className="a-form">
            {visible(config.fields, editing.form).map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint} full={f.full ?? ['textarea', 'steps', 'chips', 'image', 'nutrition', 'variants', 'credit', 'micros', 'json', 'ingredients'].includes(f.type)} htmlFor={`f-${f.key}`}>
                <FieldInput f={f} value={editing.form[f.key]} onChange={(v) => set(f.key, v)} />
              </Field>
            ))}
          </div>
        )}
        <ErrorNote error={error} />
      </Drawer>
    </>
  );
}
