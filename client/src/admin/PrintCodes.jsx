import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { api } from '../lib/api.js';

// Trang in tem mã kích hoạt: lưới tem 4 cột (khổ A4), mỗi tem = QR (link /activate?code=…) + mã nhập tay + số ngày.
// Mở ở tab riêng (/admin/activation/:id/print) → Ctrl/⌘ + P. Chỉ in mã CHƯA DÙNG.
export default function PrintCodes() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get(`/admin/activation/${id}/codes?status=new&all=1`);
        const labels = await Promise.all(d.items.map(async (c) => ({ ...c, qr: await QRCode.toDataURL(c.link, { margin: 1, width: 220, errorCorrectionLevel: 'M', color: { dark: '#2F4B23', light: '#FFFFFF' } }) })));
        setState({ batch: d.batch, labels });
      } catch (e) {
        setState({ error: e.message });
      }
    })();
  }, [id]);

  useEffect(() => {
    document.title = state.batch ? `In tem — ${state.batch.name}` : 'In tem mã kích hoạt';
  }, [state.batch]);

  if (state.loading) return <p className="p-8 text-sm text-muted">Đang tạo mã QR…</p>;
  if (state.error) return <p className="p-8 text-sm text-warm-dark">{state.error}</p>;
  return (
    <main className="min-h-dvh bg-white p-6 print:p-0">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-extrabold text-brand-core">{state.batch.name}</h1>
          <p className="text-sm text-muted">{state.labels.length} tem chưa dùng • mỗi mã +{state.batch.days} ngày • in khổ A4, cắt theo đường viền nhạt</p>
        </div>
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-dark px-6 font-bold text-white">
          <Printer size={18} aria-hidden="true" /> In tem
        </button>
      </header>
      <div className="grid grid-cols-4 gap-0 print:grid-cols-4">
        {state.labels.map((c) => (
          <div key={c._id} className="flex break-inside-avoid flex-col items-center gap-1 border border-dashed border-border p-3 text-center">
            <img src={c.qr} alt={`QR ${c.pretty}`} className="size-28" />
            <p className="font-mono text-sm font-bold tracking-wider text-primary">{c.pretty}</p>
            <p className="text-[10px] leading-tight text-secondary">Quét để kích hoạt app NUTRIVA • +{c.days} ngày</p>
          </div>
        ))}
      </div>
    </main>
  );
}
