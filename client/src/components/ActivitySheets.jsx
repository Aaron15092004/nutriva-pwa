import { useState } from 'react';
import { Droplets, Minus } from 'lucide-react';
import { changeWater } from '../lib/logs.js';
import { num } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { Sheet, Ring } from './ui.jsx';
import { PrimaryButton } from './ds/form.jsx';

export function WaterSheet({ open, onClose, date, log, targetMl, onLog }) {
  const [busy, setBusy] = useState(false);
  const water = log?.waterMl ?? 0;
  const toast = useToast();
  const change = async (ml) => {
    setBusy(true);
    try {
      const r = await changeWater(date, log, ml);
      onLog(r.log);
      if (r.queued) toast('Đã lưu trên máy — sẽ đồng bộ khi có mạng');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Uống nước">
      <div className="flex flex-col items-center gap-6">
        <Ring value={water} max={targetMl} size={168} stroke={14} color="var(--water)" track="#d6eaf8">
          <div className="flex flex-col items-center">
            <Droplets size={24} className="text-water-icon" aria-hidden="true" />
            <span className="font-secondary text-3xl font-bold tabular-nums text-primary">{num(water)}</span>
            <span className="text-sm text-muted">/ {num(targetMl)} ml</span>
          </div>
        </Ring>
        <div className="flex items-center gap-2">
          <button type="button" className="grid size-11 place-items-center rounded-full bg-water-card text-water-icon transition active:scale-95 disabled:opacity-40" aria-label="Bớt 100 ml" disabled={busy || water <= 0} onClick={() => change(-100)}>
            <Minus size={20} aria-hidden="true" />
          </button>
          {[100, 200, 300].map((ml) => (
            <button key={ml} type="button" className="h-11 rounded-full bg-water-card px-4 text-sm font-bold text-dinner-hint transition active:scale-95 disabled:opacity-50" disabled={busy} onClick={() => change(ml)}>
              +{ml} ml
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-muted">Mục tiêu ≈ 35 ml × cân nặng mỗi ngày. Uống rải rác, không đợi khát.</p>
        <PrimaryButton onClick={onClose} className="w-full">Xong</PrimaryButton>
      </div>
    </Sheet>
  );
}
