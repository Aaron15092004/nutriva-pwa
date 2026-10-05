import { useState } from 'react';
import { weekdayShort, dayNum } from '../lib/format.js';

// Điểm tuân thủ: 100% khi calo đã ăn đúng mục tiêu, giảm dần theo độ lệch. Ngày chưa ghi → null.
export function complianceScore(kcal, target) {
  if (!kcal) return null;
  return Math.max(0, Math.round(100 - (Math.abs(kcal - target) / target) * 100));
}

// Biểu đồ cột 1 series (không cần chú giải); hover/focus hiện giá trị, có bảng ẩn cho trình đọc màn hình.
export default function ComplianceChart({ days, selected }) {
  const [hover, setHover] = useState(null);
  const H = 120;
  return (
    <div>
      <div style={{ position: 'relative', height: H + 36, display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 6, alignItems: 'end', borderBottom: '1px solid var(--border)', paddingTop: 20 }} aria-hidden="true">
        {[50, 100].map((g) => (
          <span key={g} style={{ position: 'absolute', left: 0, right: 0, bottom: 36 + (H * g) / 100, borderTop: '1px dashed #dee6e1' }}>
            <span className="xs muted" style={{ position: 'absolute', right: 0, top: -16, fontSize: 10 }}>{g}%</span>
          </span>
        ))}
        {days.map((d) => {
          const v = d.score;
          const active = hover === d.date || selected === d.date;
          return (
            <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end', position: 'relative' }}
              onMouseEnter={() => setHover(d.date)} onMouseLeave={() => setHover(null)}>
              {hover === d.date && (
                <span className="xs" style={{ position: 'absolute', bottom: 36 + (H * (v ?? 0)) / 100 + 22, background: 'var(--green-900)', color: '#fff', padding: '4px 8px', borderRadius: 8, whiteSpace: 'nowrap', zIndex: 2 }}>
                  {v == null ? 'Chưa ghi nhận' : `${v}% • ${d.kcal} kcal`}
                </span>
              )}
              {v != null && active && <span className="xs strong tabular" style={{ color: 'var(--text)' }}>{v}%</span>}
              <span style={{
                width: '62%', maxWidth: 28, height: v == null ? 4 : Math.max(4, (H * v) / 100),
                borderRadius: '4px 4px 0 0', background: v == null ? '#dee6e1' : active ? 'var(--primary)' : 'var(--green-400)',
                transition: 'height .5s var(--ease), background .2s',
              }} />
              <span className="xs" style={{ lineHeight: 1.1, textAlign: 'center', color: active ? 'var(--green-800)' : 'var(--muted)', fontWeight: active ? 700 : 500, height: 30 }}>
                {weekdayShort(d.date)}<br />{dayNum(d.date)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="sr-only"><table>
        <caption>Mức độ tuân thủ kế hoạch theo ngày</caption>
        <thead><tr><th>Ngày</th><th>Tuân thủ</th><th>Calo đã ăn</th></tr></thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}><td>{d.date}</td><td>{d.score == null ? 'Chưa ghi nhận' : `${d.score}%`}</td><td>{d.kcal}</td></tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
