import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Leaf, RefreshCw, CalendarCheck, Info, UserRound, ChevronRight, ThumbsUp, ThumbsDown } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { TopBar, Logo } from '../../components/ui.jsx';

const QUICK = [
  { icon: Leaf, text: 'Vì sao chọn sữa này?' },
  { icon: RefreshCw, text: 'Đổi set tự làm' },
  { icon: CalendarCheck, text: 'Điều chỉnh kế hoạch' },
];

function BotAvatar() {
  return <span className="icon-tile" style={{ width: 36, height: 36, borderRadius: 99, background: '#fff', boxShadow: 'var(--shadow)' }}><Logo size={22} withText={false} /></span>;
}

export default function Assistant() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([
    { from: 'bot', text: `Xin chào ${user.name}! Tôi là Trợ lý NUTRIVA. Bạn có thể hỏi tôi về sản phẩm, gợi ý thực đơn hoặc cách xây dựng kế hoạch dinh dưỡng phù hợp với bạn.` },
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rated, setRated] = useState({});
  const end = useRef();

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy]);

  const ask = async (q) => {
    const message = q.trim();
    if (!message || busy) return;
    setText('');
    setMsgs((m) => [...m, { from: 'me', text: message }]);
    setBusy(true);
    try {
      // Lịch sử hội thoại (bỏ lời chào đầu & tin lỗi) để trợ lý hiểu ngữ cảnh
      const history = msgs
        .slice(1)
        .filter((m) => !m.error)
        .map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }));
      const r = await api.post('/assistant', { message, history });
      setMsgs((m) => [...m, { from: 'bot', ...r }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: 'bot', text: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="Trợ lý NUTRIVA" />
      <main className="page no-nav stack" style={{ paddingBottom: 'calc(var(--safe-b) + 150px)' }}>
        <p className="small muted center">Luôn sẵn sàng đồng hành cùng bạn.</p>
        <div className="stack" aria-live="polite">
          {msgs.map((m, i) =>
            m.from === 'bot' ? (
              <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
                <BotAvatar />
                <div className="stack" style={{ gap: 8, maxWidth: '82%' }}>
                  <div className="card" style={{ padding: '10px 14px', borderTopLeftRadius: 6, fontSize: 15, whiteSpace: 'pre-wrap', background: m.error ? 'var(--danger-bg)' : '#fff' }}>{m.text}</div>
                  {m.product && (
                    <Link to={`/shop/p/${m.product.slug}`} className="card card-link" style={{ padding: 10 }}>
                      <img src={m.product.image} alt="" className="thumb" />
                      <span className="grow">
                        <b style={{ fontSize: 14, display: 'block' }}>{m.product.type === 'diy' ? 'Set tự làm ' : 'Sữa hạt '}{m.product.name}</b>
                        <span className="xs muted">{m.product.subtitle}</span>
                        <span className="small green strong" style={{ display: 'block' }}>Xem chi tiết • {money(m.product.price)}</span>
                      </span>
                    </Link>
                  )}
                  {m.link && <Link to={m.link.to} className="link">{m.link.label} <ChevronRight size={16} /></Link>}
                  {i > 0 && !m.error && (
                    <div className="row" style={{ gap: 0 }}>
                      <button className="icon-btn" aria-label="Hữu ích" aria-pressed={rated[i] === 'up'} onClick={() => setRated({ ...rated, [i]: 'up' })}><ThumbsUp size={16} color={rated[i] === 'up' ? 'var(--primary)' : 'var(--subtle)'} /></button>
                      <button className="icon-btn" aria-label="Chưa hữu ích" aria-pressed={rated[i] === 'down'} onClick={() => setRated({ ...rated, [i]: 'down' })}><ThumbsDown size={16} color={rated[i] === 'down' ? 'var(--danger)' : 'var(--subtle)'} /></button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={i} className="row" style={{ justifyContent: 'flex-end' }}>
                <div className="card" style={{ padding: '10px 14px', borderTopRightRadius: 6, background: 'var(--green-100)', boxShadow: 'none', maxWidth: '80%', fontSize: 15, whiteSpace: 'pre-wrap' }}>{m.text}</div>
              </div>
            ),
          )}
          {busy && (
            <div className="row" style={{ gap: 8 }}>
              <BotAvatar />
              <span className="card small muted" style={{ padding: '10px 14px' }}>Đang soạn trả lời…</span>
            </div>
          )}
          <div ref={end} />
        </div>

        {msgs.length === 1 && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="small muted">Bạn có thể thử hỏi:</span>
            <div className="grid-3">
              {QUICK.map((q) => (
                <button key={q.text} className="choice" style={{ minHeight: 72, fontSize: 12.5 }} onClick={() => ask(q.text)}>
                  <q.icon size={20} /> {q.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <Link to="/me/support" className="card card-link" style={{ background: 'var(--warn-bg)', boxShadow: 'none' }}>
          <span className="icon-tile warn"><UserRound size={22} /></span>
          <span className="grow"><b style={{ display: 'block' }}>Trao đổi với chuyên gia</b><span className="small muted">Nhận tư vấn cá nhân từ chuyên gia dinh dưỡng</span></span>
          <ChevronRight size={20} className="chev" />
        </Link>
      </main>

      <form
        className="sticky-cta"
        style={{ flexDirection: 'column', gap: 6 }}
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <span className="xs muted row" style={{ gap: 4 }}><Info size={14} /> Không chẩn đoán hoặc kê chế độ điều trị.</span>
        <div className="row" style={{ gap: 8 }}>
          <div className="input-wrap grow" style={{ minHeight: 50, background: '#fff' }}>
            <input aria-label="Nhập câu hỏi" placeholder="Nhập câu hỏi của bạn" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} style={{ height: 46, fontWeight: 500 }} />
          </div>
          <button type="submit" className="round-add solid" aria-label="Gửi" disabled={!text.trim() || busy} style={{ width: 50, height: 50 }}><Send size={20} /></button>
        </div>
      </form>
    </>
  );
}
