import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Upload, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { MICRONUTRIENTS } from '@shared/nutrition.js';

// ---------- Data hooks ----------
export function useAdminList(path, params) {
  const [state, setState] = useState({ items: [], total: 0, loading: true, error: '' });
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const d = await api.get(`${path}?${qs}`);
      setState({ items: d.items, total: d.total, loading: false, error: '', data: d }); // data: phản hồi gốc (vd số đếm hàng chờ)
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [path, qs]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load, setItems: (fn) => setState((s) => ({ ...s, items: fn(s.items) })) };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ---------- Layout ----------
export function Drawer({ open, title, onClose, children, footer }) {
  const ref = useRef();
  // onClose giữ trong ref: tránh kéo focus về khung mỗi lần trang cha render lại (đang gõ bị mất con trỏ)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="a-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="a-drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="a-drawer-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Đóng" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="a-drawer-body">{children}</div>
        {footer && <div className="a-drawer-foot">{footer}</div>}
      </aside>
    </div>
  );
}

export function Pager({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="a-pager">
      <span>{total.toLocaleString('vi-VN')} mục • Trang {page}/{pages}</span>
      <div className="row" style={{ gap: 4 }}>
        <button className="icon-btn" aria-label="Trang trước" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={18} /></button>
        <button className="icon-btn" aria-label="Trang sau" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

// Ô nhập có nhãn; error: hiện ngay dưới ô (thay cho gợi ý), required: dấu * đỏ cạnh nhãn
export function Field({ label, hint, full, children, htmlFor, error, required }) {
  const lbl = (
    <>
      {label}
      {required && <span className="req" aria-hidden="true"> *</span>}
    </>
  );
  return (
    <div className={`a-field ${full ? 'full' : ''} ${error ? 'invalid' : ''}`}>
      {label && (htmlFor ? <label htmlFor={htmlFor}>{lbl}</label> : <span className="lbl">{lbl}</span>)}
      {children}
      {error ? (
        <span className="a-err" id={htmlFor ? `${htmlFor}-err` : undefined} role="alert">{error}</span>
      ) : (
        hint && <span className="hint">{hint}</span>
      )}
    </div>
  );
}

// ---------- Ô nhập số ----------
const fmtNum = (v, money) => (v == null || Number.isNaN(v) ? '' : money ? Math.round(v).toLocaleString('vi-VN') : String(v).replace('.', ','));
// "35.000" / "35000" / "5,5" / "5.5" → số; trống → null; sai → NaN
export function parseNum(text, { money = false, integer = false } = {}) {
  const t = String(text ?? '').replace(/\s/g, '');
  if (t === '' || t === '-') return null;
  // Tiền & số nguyên: dấu . và , đều là phân cách hàng nghìn. Số thập phân: , hoặc . là dấu thập phân
  const raw = money || integer ? t.replace(/[.,]/g, '') : t.replace(',', '.');
  if (!/^-?\d*\.?\d*$/.test(raw)) return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

// Kiểm tra 1 giá trị số theo luật { required, min, max, integer } → thông báo lỗi tiếng Việt hoặc ''
export function numError(v, { required, min, max, integer, money } = {}) {
  if (Number.isNaN(v)) return 'Chỉ nhập số (vd: 35000 hoặc 5,5)';
  if (v == null) return required ? 'Bắt buộc nhập' : '';
  if (integer && !Number.isInteger(v)) return 'Nhập số nguyên';
  if (min != null && v < min) return `Tối thiểu ${fmtNum(min, money)}`;
  if (max != null && v > max) return `Tối đa ${fmtNum(max, money)}`;
  return '';
}

// Ô số dễ nhập: xóa trống được (không tự thành 0), gõ dấu phẩy thập phân, tiền tự thêm dấu chấm khi rời ô,
// cuộn chuột không làm đổi số. value: number | null → onChange(number | null). Gõ chữ → báo "Chỉ nhập số".
export function NumInput({ id, value, onChange, money = false, integer = false, suffix, placeholder, disabled, invalid, className = '', style, onBlur, onFocus, ...rest }) {
  const [text, setText] = useState(() => fmtNum(value, money));
  const [focused, setFocused] = useState(false);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmtNum(value, money));
  }, [value, focused, money]);
  const change = (t) => {
    setText(t);
    const n = parseNum(t, { money, integer });
    setBad(Number.isNaN(n));
    if (!Number.isNaN(n)) onChange(n);
  };
  return (
    <span className={`a-num ${className}`} style={style}>
      <input
        id={id}
        className="a-input"
        type="text"
        inputMode={money || integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || bad || undefined}
        aria-describedby={id ? `${id}-err` : undefined}
        onFocus={(e) => {
          setFocused(true);
          if (money && value != null) setText(String(Math.round(value)));
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          if (!bad) setText(fmtNum(parseNum(text, { money, integer }), money));
          onBlur?.(e);
        }}
        onChange={(e) => change(e.target.value)}
        {...rest}
      />
      {suffix && <span className="a-num-suffix" aria-hidden="true">{suffix}</span>}
      {bad && <span className="a-err">Chỉ nhập số</span>}
    </span>
  );
}

// "Sữa hạt Mạch Nhiên" → "sua-hat-mach-nhien" (bỏ dấu tiếng Việt)
export const slugify = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

// ---------- Inputs ----------
export async function uploadImage(file) {
  return (await api.upload('/admin/uploads', file)).url;
}

export function ImageInput({ value, onChange, id }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      onChange(await uploadImage(f));
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="a-img-pick">
        {value ? <img src={value} alt="" /> : <span className="a-img-pick" style={{ width: 72, height: 72, borderRadius: 12, background: 'var(--green-50)', border: '1px dashed var(--border)' }} />}
        <div className="stack grow" style={{ gap: 6 }}>
          <label className="btn btn-soft btn-xs" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
            {busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />} Tải ảnh lên
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden onChange={pick} />
          </label>
          <input id={id} className="a-input" placeholder="hoặc dán URL / đường dẫn ảnh" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      </div>
      {err && <span className="field-error">{err}</span>}
    </div>
  );
}

export function ChipsInput({ options, value = [], onChange }) {
  return (
    <div className="a-chips">
      {options.map((o) => (
        <button type="button" key={o.id} aria-pressed={value.includes(o.id)} onClick={() => onChange(value.includes(o.id) ? value.filter((x) => x !== o.id) : [...value, o.id])}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StepsInput({ value = [], onChange }) {
  const set = (i, patch) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="a-steps">
      {value.map((s, i) => (
        <div key={i} className="a-card" style={{ padding: 10, display: 'flex', gap: 8 }}>
          <b style={{ width: 22, paddingTop: 8 }}>{i + 1}</b>
          <div className="stack grow" style={{ gap: 6 }}>
            <input className="a-input" placeholder="Tiêu đề bước" value={s.title} onChange={(e) => set(i, { title: e.target.value })} />
            <textarea className="a-textarea" style={{ minHeight: 60 }} placeholder="Nội dung" value={s.text} onChange={(e) => set(i, { text: e.target.value })} />
          </div>
          <button type="button" className="icon-btn" aria-label={`Xóa bước ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 size={16} color="var(--danger)" /></button>
        </div>
      ))}
      <button type="button" className="btn btn-soft btn-xs" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...value, { title: '', text: '' }])}><Plus size={15} /> Thêm bước</button>
    </div>
  );
}

// Danh sách mức độ + hệ số MET (hoạt động thể chất)
export function VariantsInput({ value = [], onChange }) {
  const set = (i, patch) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div className="a-steps">
      {value.map((v, i) => (
        <div key={i} className="row" style={{ gap: 8 }}>
          <input className="a-input grow" aria-label={`Tên mức độ ${i + 1}`} placeholder="Tên mức độ (vd: Hatha yoga)" value={v.name} onChange={(e) => set(i, { name: e.target.value })} />
          <NumInput style={{ width: 96 }} aria-label={`MET mức độ ${i + 1}`} placeholder="MET" value={v.met ?? null} invalid={v.met != null && !(v.met > 0 && v.met <= 25)} onChange={(met) => set(i, { met })} />
          <button type="button" className="icon-btn" aria-label={`Xóa mức độ ${i + 1}`} disabled={value.length <= 1} onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 size={16} color="var(--danger)" /></button>
        </div>
      ))}
      <button type="button" className="btn btn-soft btn-xs" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...value, { name: '', met: 3 }])}><Plus size={15} /> Thêm mức độ</button>
    </div>
  );
}

// Nguyên liệu món ăn: chọn thực phẩm (gợi ý từ bảng thực phẩm) + số gram; xem trước tổng dinh dưỡng
let foodsCache = null;
export function IngredientsInput({ value = [], onChange }) {
  const [foods, setFoods] = useState(foodsCache ?? []);
  useEffect(() => {
    if (foodsCache) return;
    api.get('/foods').then((d) => { foodsCache = d.foods; setFoods(d.foods); }).catch(() => {});
  }, []);
  const byName = new Map(foods.map((f) => [f.name, f]));
  const byKey = new Map(foods.map((f) => [f.id ?? f.key, f]));
  const set = (i, patch) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const setName = (i, name) => set(i, { name, food: byName.get(name)?.id ?? byName.get(name)?.key ?? '' });
  const total = { kcal: 0, protein: 0, carb: 0, fat: 0 };
  let missing = 0;
  for (const v of value) {
    const f = byKey.get(v.food) ?? byName.get(v.name);
    if (!f) { missing++; continue; }
    for (const k of Object.keys(total)) total[k] += (f[k] * (Number(v.grams) || 0)) / 100;
  }
  const r = (n, d = 0) => n.toLocaleString('vi-VN', { maximumFractionDigits: d });
  return (
    <div className="a-steps">
      <datalist id="ing-foods">{foods.map((f) => <option key={f.id ?? f.key} value={f.name} />)}</datalist>
      {value.map((v, i) => {
        const f = byKey.get(v.food) ?? byName.get(v.name);
        return (
          <div key={i} className="row" style={{ gap: 8 }}>
            <div className="grow">
              <input className="a-input" style={{ width: '100%' }} list="ing-foods" aria-label={`Nguyên liệu ${i + 1}`} placeholder="Gõ tên thực phẩm…" value={v.name ?? ''} onChange={(e) => setName(i, e.target.value)} aria-invalid={!f && Boolean(v.name)} />
              {v.name && !f && <div className="xs" style={{ color: 'var(--danger)' }}>Chưa có trong bảng thực phẩm</div>}
            </div>
            <NumInput style={{ width: 96 }} suffix="g" aria-label={`Số gram nguyên liệu ${i + 1}`} placeholder="gram" value={v.grams === '' ? null : v.grams ?? null} invalid={v.grams != null && v.grams !== '' && !(v.grams > 0)} onChange={(g) => set(i, { grams: g ?? '' })} />
            <button type="button" className="icon-btn" aria-label={`Xóa nguyên liệu ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 size={16} color="var(--danger)" /></button>
          </div>
        );
      })}
      <button type="button" className="btn btn-soft btn-xs" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...value, { food: '', name: '', grams: 100 }])}><Plus size={15} /> Thêm nguyên liệu</button>
      {value.length > 0 && (
        <div className="xs muted tabular">
          Ước tính: <b>{r(total.kcal)} kcal</b> • Đạm {r(total.protein, 1)} g • Bột đường {r(total.carb, 1)} g • Béo {r(total.fat, 1)} g
          {missing > 0 && ` (thiếu ${missing} nguyên liệu)`}
        </div>
      )}
    </div>
  );
}

// ---- Vi chất: tóm gọn trong bảng, mở rộng khi sửa ----
const n1 = (v) => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const KEY_MICROS = ['calcium', 'iron', 'vitaminC', 'vitaminA'];
// Ô bảng: vài chỉ số chính + số còn lại; di chuột để xem đủ
export function MicroSummary({ micros }) {
  const have = MICRONUTRIENTS.filter((m) => micros?.[m.id] != null);
  if (!have.length) return <span className="muted">—</span>;
  const main = have.filter((m) => KEY_MICROS.includes(m.id));
  const title = have.map((m) => `${m.label}: ${n1(micros[m.id])} ${m.unit}`).join('\n');
  return (
    <span title={title} className="xs" style={{ whiteSpace: 'nowrap' }}>
      {main.map((m) => `${m.short} ${n1(micros[m.id])}`).join(' · ')}
      {have.length > main.length && <span className="muted"> +{have.length - main.length}</span>}
    </span>
  );
}

// Ô sửa: thu gọn mặc định, mở ra theo 2 nhóm Khoáng chất / Vitamin
export function MicrosInput({ value = {}, onChange, readOnly }) {
  const filled = MICRONUTRIENTS.filter((m) => value?.[m.id] != null).length;
  const set = (k, v) => onChange({ ...value, [k]: v === '' ? null : Number(v) });
  return (
    <details className="a-micros">
      <summary>
        {filled}/{MICRONUTRIENTS.length} chỉ số có số liệu {readOnly ? '(tính từ nguyên liệu)' : ''} — <MicroSummary micros={value} />
      </summary>
      {[
        ['mineral', 'Khoáng chất'],
        ['vitamin', 'Vitamin'],
      ].map(([kind, label]) => (
        <fieldset key={kind}>
          <legend className="xs muted">{label}</legend>
          <div className="a-micro-grid">
            {MICRONUTRIENTS.filter((m) => m.kind === kind).map((m) => (
              <label key={m.id}>
                <span className="xs muted">{m.label} ({m.unit})</span>
                <NumInput value={value?.[m.id] === '' || value?.[m.id] == null ? null : Number(value[m.id])} disabled={readOnly} aria-label={m.label ?? m.id} onChange={(v) => set(m.id, v ?? '')} />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </details>
  );
}

// Ô JSON (dữ liệu có cấu trúc lớn, vd lịch 7 ngày của kế hoạch). Chỉ gọi onChange khi JSON hợp lệ.
export function JsonInput({ value, onChange, rows = 14 }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? [], null, 1));
  const [err, setErr] = useState('');
  return (
    <div className="stack" style={{ gap: 4 }}>
      <textarea
        className="a-textarea"
        style={{ minHeight: rows * 18, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12 }}
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setErr('');
          } catch {
            setErr('JSON chưa hợp lệ — thay đổi chưa được áp dụng');
          }
        }}
      />
      {err && <span className="xs" style={{ color: 'var(--danger)' }}>{err}</span>}
    </div>
  );
}

export const vnd = (n) => `${Math.round(n ?? 0).toLocaleString('vi-VN')}đ`;
export const dt = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

// Tải file CSV từ API cần đăng nhập (không dùng được thẻ <a href> trực tiếp vì cần header Authorization)
export async function downloadFile(path, filename) {
  const { tokenStore } = await import('../lib/api.js');
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? '/api'}${path}`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
  if (!res.ok) throw new Error('Không tải được file');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const ymd = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
export const plusDays = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
