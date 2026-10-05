import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, weekStart, weekdayShort, dayNum, today } from '../lib/format.js';

export default function DateStrip({ value, onChange }) {
  const start = weekStart(value);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const t = today();
  return (
    <div className="date-strip" role="group" aria-label="Chọn ngày">
      <button className="nav" aria-label="Tuần trước" onClick={() => onChange(addDays(value, -7))}>
        <ChevronLeft size={20} />
      </button>
      {days.map((d) => (
        <button
          key={d}
          className={`day ${d === t ? 'today' : ''}`}
          aria-pressed={d === value}
          aria-label={`${weekdayShort(d)} ngày ${dayNum(d)}${d === t ? ' (hôm nay)' : ''}`}
          onClick={() => onChange(d)}
        >
          {weekdayShort(d)}
          <b>{dayNum(d)}</b>
        </button>
      ))}
      <button className="nav" aria-label="Tuần sau" onClick={() => onChange(addDays(value, 7))}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
