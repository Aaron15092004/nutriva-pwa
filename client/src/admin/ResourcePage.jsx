import { useState } from 'react';
import { Plus, Search, Trash2, Save } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote } from '../components/ui.jsx';
import { useAdminList, useDebounced, Drawer, Pager, Field, NumInput, numError, slugify, ImageInput, ChipsInput, StepsInput, VariantsInput, IngredientsInput, MicrosInput, JsonInput } from './kit.jsx';

const NUTRITION = [['kcal', 'kcal'], ['protein', 'Đạm (g)'], ['carb', 'Bột đường (g)'], ['fat', 'Béo (g)']];

// Trang CRUD chung, cấu hình bằng `config` (xem resources.jsx)
function FieldInput({ f, value, onChange, invalid, form }) {
  const id = `f-${f.key}`;
  if (f.readOnly && f.display) return <div className="a-static">{f.display(value, form)}</div>;
  switch (f.type) {
    case 'number':
      return <NumInput id={id} value={value ?? null} onChange={onChange} money={f.money} integer={f.integer} suffix={f.suffix} placeholder={f.placeholder} invalid={invalid} disabled={f.readOnly} />;
    case 'textarea':
      return <textarea id={id} className="a-textarea" maxLength={f.maxLength} value={value ?? ''} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <select id={id} className="a-select" value={value ?? ''} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)}>
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
      return <input id={id} className="a-input" type="datetime-local" value={value ? new Date(new Date(value).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />;
    case 'nutrition':
      return (
        <div className="grid-4">
          {NUTRITION.map(([k, l]) => (
            <label key={k} className="stack" style={{ gap: 2 }}>
              <span className="xs muted">{l}</span>
              <NumInput value={value?.[k] ?? null} onChange={(v) => onChange({ ...value, [k]: v })} invalid={invalid && (value?.[k] == null || value[k] < 0)} aria-label={l} />
            </label>
          ))}
        </div>
      );
    default:
      return <input id={id} className="a-input" maxLength={f.maxLength} value={value ?? ''} placeholder={f.placeholder} aria-invalid={invalid || undefined} onChange={(e) => onChange(f.upper ? e.target.value.toUpperCase() : e.target.value)} />;
  }
}

// Luật kiểm tra theo khai báo trường: required, min, max, integer, maxLength, pattern (+ patternMsg), validate(v, form)
function fieldError(f, v, form) {
  if (f.readOnly) return '';
  const custom = f.validate?.(v, form);
  if (custom) return custom;
  if (f.type === 'number') return numError(v, f);
  if (f.type === 'nutrition') return NUTRITION.some(([k]) => v?.[k] == null || v[k] < 0) ? 'Nhập đủ 4 chỉ số (số ≥ 0)' : '';
  const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
  if (empty) return f.required ? 'Bắt buộc nhập' : '';
  if (typeof v === 'string') {
    if (f.maxLength && v.length > f.maxLength) return `Tối đa ${f.maxLength} ký tự (đang ${v.length})`;
    if (f.pattern && !f.pattern.test(v)) return f.patternMsg ?? 'Sai định dạng';
  }
  return '';
}

// Trường có `show(form)` chỉ hiện (và chỉ gửi đi) khi điều kiện đúng
const visible = (fields, form) => fields.filter((f) => !f.show || f.show(form));
const FULL = ['textarea', 'steps', 'chips', 'image', 'nutrition', 'variants', 'credit', 'micros', 'json', 'ingredients'];

export default function ResourcePage({ config }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const list = useAdminList(config.path, { q: search, page, limit: 30, ...filters });
  const [editing, setEditing] = useState(null); // { id?, form, touched: Set, submitted, server: {}, slugEdited }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const open = (item) => {
    setError('');
    setEditing(item ? { id: item._id, form: { ...item }, touched: new Set(), server: {}, slugEdited: true } : { form: { ...config.defaults }, touched: new Set(), server: {}, slugEdited: false });
  };
  const set = (key, v) =>
    setEditing((e) => {
      const form = { ...e.form, [key]: v };
      // Thêm mới: mã/slug tự sinh theo tên cho tới khi admin tự sửa ô mã
      const auto = config.slug;
      if (auto && !e.id && !e.slugEdited && key !== auto.field && auto.from.includes(key)) form[auto.field] = auto.make(form);
      const server = { ...e.server };
      delete server[key];
      return { ...e, form, server, slugEdited: e.slugEdited || key === auto?.field };
    });
  const touch = (key) => setEditing((e) => (e.touched.has(key) ? e : { ...e, touched: new Set([...e.touched, key]) }));

  const fields = editing ? visible(config.fields, editing.form) : [];
  const errors = editing ? Object.fromEntries(fields.map((f) => [f.key, fieldError(f, editing.form[f.key], editing.form)]).filter(([, m]) => m)) : {};
  const shown = (key) => editing?.server[key] || ((editing?.submitted || editing?.touched.has(key)) && errors[key]) || '';

  const save = async () => {
    const bad = Object.keys(errors);
    if (bad.length) {
      setEditing((e) => ({ ...e, submitted: true }));
      setError(`Kiểm tra lại ${bad.length} trường được đánh dấu đỏ`);
      document.getElementById(`f-${bad[0]}`)?.focus();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = Object.fromEntries(fields.filter((f) => !f.readOnly).map((f) => [f.key, editing.form[f.key]]));
      if (editing.id) await api.patch(`${config.path}/${editing.id}`, body);
      else await api.post(config.path, body);
      toast(editing.id ? 'Đã lưu thay đổi' : `Đã thêm ${config.singular}`);
      setEditing(null);
      list.reload();
    } catch (e) {
      // Lỗi theo từng trường từ server (trùng mã, sai định dạng…) → hiện ngay dưới ô
      if (e.data?.fields) setEditing((x) => ({ ...x, server: e.data.fields, submitted: true }));
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

  const columns = config.rowActions ? [...config.columns, { key: '_actions', label: '', render: config.rowActions }] : config.columns;
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
            <tr>{columns.map((c) => <th key={c.key} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {list.items.map((it) => (
              <tr key={it._id} onClick={() => open(it)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && open(it)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.num ? 'num' : c.key === '_actions' ? 'num whitespace-nowrap' : ''} onClick={c.key === '_actions' ? (e) => e.stopPropagation() : undefined}>
                    {c.render ? c.render(it) : String(it[c.key] ?? '')}
                  </td>
                ))}
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
          <form
            className="a-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {fields.map((f) => (
              <div key={f.key} className="contents" onBlur={() => touch(f.key)}>
                <Field label={f.label} hint={f.hint} required={f.required} error={shown(f.key)} full={f.full ?? FULL.includes(f.type)} htmlFor={`f-${f.key}`}>
                  <FieldInput f={f} value={editing.form[f.key]} form={editing.form} invalid={Boolean(shown(f.key))} onChange={(v) => set(f.key, v)} />
                </Field>
              </div>
            ))}
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
        )}
        <ErrorNote error={error} />
      </Drawer>
    </>
  );
}
