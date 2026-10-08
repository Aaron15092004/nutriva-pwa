import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, ChevronRight, ThumbsUp, ThumbsDown, UserRound, BookOpen, Info, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { money } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CircleButton, cx } from '../../components/ds/index.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import Nuti from '../../components/mascot/Nuti.jsx';

const SUGGESTIONS = [
  'Hôm nay mình nên ăn thêm gì?',
  'Bữa tối nhẹ cho người giảm cân?',
  'Sữa hạt nào hợp với mình?',
  'Uống bao nhiêu nước là đủ?',
  'Ăn chay có đủ đạm không?',
];

// Bong bóng tin nhắn của Nuti
function BotBubble({ m, idx, rated, onRate }) {
  return (
    <div className="flex items-start gap-2">
      <Nuti mood={m.error ? 'sorry' : 'happy'} size={36} animated={false} />
      <div className="flex min-w-0 max-w-[85%] flex-col gap-2">
        <div className={cx('whitespace-pre-wrap rounded-xl rounded-bl-sm px-4 py-2 text-base leading-6 shadow-card', m.error ? 'bg-error text-warm-dark' : 'bg-white text-primary')}>{m.text}</div>

        {m.sources?.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg bg-brand-light px-4 py-2">
            <span className="flex items-center gap-1 font-secondary text-xs font-bold text-brand-deep">
              <BookOpen size={14} aria-hidden="true" /> Nguồn tham khảo
            </span>
            <ol className="flex flex-col gap-1">
              {m.sources.map((s, i) => (
                <li key={i} className="text-xs text-secondary">
                  {i + 1}.{' '}
                  {/^https?:\/\//.test(s.source) ? (
                    <a href={s.source} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">{s.title}</a>
                  ) : (
                    s.title
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {m.product && (
          <Link to={`/shop/p/${m.product.slug}`} className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-card transition hover:shadow-float active:scale-[0.99]">
            <ProductImage product={m.product} ratio="1/1" className="w-14 shrink-0 rounded-md" />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm text-primary">{m.product.type === 'diy' ? 'Set tự làm ' : 'Sữa hạt '}{m.product.name}</b>
              <span className="font-secondary text-xs font-bold text-brand-dark">Xem chi tiết • {money(m.product.price)}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-subtle" aria-hidden="true" />
          </Link>
        )}
        {m.link && (
          <Link to={m.link.to} className="inline-flex h-9 items-center gap-1 self-start rounded-full bg-brand-light px-4 text-sm font-bold text-brand-dark hover:bg-brand-soft">
            {m.link.label} <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )}
        {idx > 0 && !m.error && (
          <div className="-ml-2 flex">
            <button type="button" aria-label="Hữu ích" aria-pressed={rated === 'up'} onClick={() => onRate('up')} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface">
              <ThumbsUp size={16} className={rated === 'up' ? 'text-brand-dark' : 'text-subtle'} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Chưa hữu ích" aria-pressed={rated === 'down'} onClick={() => onRate('down')} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface">
              <ThumbsDown size={16} className={rated === 'down' ? 'text-warm-dark' : 'text-subtle'} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Assistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const status = useApi('/assistant/status');
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rated, setRated] = useState({});
  const end = useRef();
  const input = useRef();
  const empty = msgs.length === 0;

  useEffect(() => {
    if (!empty) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy, empty]);

  // Ô nhập tự giãn tối đa ~4 dòng
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const ask = async (q) => {
    const message = q.trim();
    if (!message || busy) return;
    setText('');
    setMsgs((m) => [...m, { from: 'me', text: message }]);
    setBusy(true);
    try {
      // Gửi kèm lịch sử (bỏ tin lỗi) để Nuti hiểu ngữ cảnh
      const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }));
      const r = await api.post('/assistant', { message, history });
      setMsgs((m) => [...m, { from: 'bot', ...r }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: 'bot', text: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const ai = status.data?.ai;
  return (
    <>
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 pb-2 pt-[max(8px,env(safe-area-inset-top))] backdrop-blur">
        <CircleButton icon={ArrowLeft} label="Quay lại" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))} className="bg-white text-primary shadow-pill" size={44} />
        <Nuti mood={busy ? 'thinking' : 'happy'} size={40} animated={false} />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-extrabold text-primary">Nuti</h1>
          <p className="flex items-center gap-1 font-secondary text-xs text-muted">
            <span className={cx('h-2 w-2 rounded-full', ai === false ? 'bg-cookie' : 'bg-brand-main')} aria-hidden="true" />
            {busy ? 'Đang soạn trả lời…' : ai === false ? 'Chế độ cơ bản' : 'Trợ lý dinh dưỡng NUTRIVA'}
          </p>
        </div>
        {!empty && (
          <CircleButton icon={RotateCcw} label="Cuộc trò chuyện mới" onClick={() => { setMsgs([]); setRated({}); }} className="bg-white text-primary shadow-pill" size={44} iconSize={18} />
        )}
      </header>

      <main className="flex min-h-[calc(100dvh-64px)] flex-col gap-4 px-4 pb-[calc(140px+var(--safe-b))] pt-4" aria-live="polite">
        {empty ? (
          <section className="flex flex-1 flex-col items-center gap-4 pt-6 text-center">
            <Nuti mood="wave" size={132} label="Nuti, linh vật NUTRIVA, đang vẫy tay chào" />
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-2xl font-bold text-brand-core [font-variation-settings:'SOFT'_100]">Chào {user.name}, mình là Nuti!</h2>
              <p className="text-sm text-secondary">Hỏi mình về món ăn, kế hoạch, sữa hạt hay cách ăn uống hợp với mục tiêu của bạn nhé.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {SUGGESTIONS.map((q) => (
                <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-primary shadow-pill transition hover:border-brand-pastel hover:bg-brand-light active:scale-95">
                  {q}
                </button>
              ))}
            </div>
            <Link to="/me/support" className="mt-auto flex w-full items-center gap-4 rounded-xl bg-warm-light p-4 text-left transition active:scale-[0.99]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-warm-dark" aria-hidden="true"><UserRound size={20} /></span>
              <span className="min-w-0 flex-1">
                <b className="block text-sm text-primary">Cần tư vấn chuyên sâu?</b>
                <span className="text-xs text-secondary">Trao đổi trực tiếp với chuyên gia dinh dưỡng</span>
              </span>
              <ChevronRight size={18} className="text-subtle" aria-hidden="true" />
            </Link>
          </section>
        ) : (
          <>
            {msgs.map((m, i) =>
              m.from === 'bot' ? (
                <BotBubble key={i} m={m} idx={i} rated={rated[i]} onRate={(v) => setRated({ ...rated, [i]: v })} />
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-brand-dark px-4 py-2 text-base leading-6 text-white">{m.text}</div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-end gap-2">
                <Nuti mood="thinking" size={36} />
                <span className="flex h-10 items-center gap-1 rounded-xl rounded-bl-sm bg-white px-4 shadow-card" role="status" aria-label="Nuti đang soạn trả lời">
                  {[0, 1, 2].map((d) => <span key={d} className="typing-dot h-2 w-2 rounded-full bg-brand-main" />)}
                </span>
              </div>
            )}
          </>
        )}
        <div ref={end} />
      </main>

      <form
        className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-app flex-col gap-1 border-t border-border bg-white/95 px-4 pb-[calc(10px+var(--safe-b))] pt-2 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={input}
            rows={1}
            aria-label="Nhập câu hỏi cho Nuti"
            placeholder="Hỏi Nuti điều gì đó…"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(text);
              }
            }}
            className="max-h-[120px] min-h-12 flex-1 resize-none rounded-[24px] border border-border bg-background px-4 py-3 text-base leading-6 text-primary outline-none transition placeholder:text-subtle focus:border-brand-main focus:ring-2 focus:ring-brand-soft"
          />
          <button type="submit" aria-label="Gửi" disabled={!text.trim() || busy} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-dark text-white transition hover:bg-brand-deep active:scale-90 disabled:opacity-40">
            <Send size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="flex items-center justify-center gap-1 font-secondary text-2xs text-muted">
          <Info size={12} aria-hidden="true" /> Nuti không chẩn đoán hay kê chế độ điều trị — hỏi bác sĩ khi có bệnh lý.
        </p>
      </form>
    </>
  );
}
