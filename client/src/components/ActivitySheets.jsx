import { useState } from 'react';
import { Droplets, Minus } from 'lucide-react';
import { api } from '../lib/api.js';
import { num } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { Sheet, Button, ErrorNote, Ring } from './ui.jsx';

export function WaterSheet({ open, onClose, date, log, targetMl, onLog }) {
  const [busy, setBusy] = useState(false);
  const water = log?.waterMl ?? 0;
  const change = async (ml) => {
    setBusy(true);
    try {
      const d = await api.post(`/logs/${date}/water`, { ml });
      onLog(d.log);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Uống nước">
      <div className="stack-lg" style={{ alignItems: 'center' }}>
        <Ring value={water} max={targetMl} size={168} stroke={14} color="var(--water)" track="#d6eaf8">
          <div>
            <Droplets size={24} color="var(--water)" style={{ margin: '0 auto' }} />
            <div className="title-lg tabular" style={{ color: 'var(--text)' }}>{num(water)}</div>
            <div className="small muted">/ {num(targetMl)} ml</div>
          </div>
        </Ring>
        <div className="row">
          <button className="round-add" aria-label="Bớt 100 ml" disabled={busy || water <= 0} onClick={() => change(-100)}><Minus size={20} /></button>
          {[100, 200, 300].map((ml) => (
            <button key={ml} className="btn btn-soft btn-sm" disabled={busy} onClick={() => change(ml)}>+{ml} ml</button>
          ))}
        </div>
        <p className="small muted center">Mục tiêu ≈ 35 ml × cân nặng mỗi ngày. Uống rải rác, không đợi khát.</p>
        <button className="btn btn-primary btn-block" onClick={onClose}>Xong</button>
      </div>
    </Sheet>
  );
}
