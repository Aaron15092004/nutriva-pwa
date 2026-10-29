import { Component } from 'react';
import { RefreshCw } from 'lucide-react';
import Nuti from './mascot/Nuti.jsx';

// Lỗi tải file JS sau khi có bản cập nhật (file cũ đã bị thay) → tải lại trang 1 lần là hết
const CHUNK_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i;
const RELOAD_KEY = 'nutriva_chunk_reload';

export function reloadOnceForChunkError() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return false; // vừa thử rồi — không lặp vô hạn
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage bị chặn */
  }
  window.location.reload();
  return true;
}

if (typeof window !== 'undefined') {
  // Vite báo lỗi tải trước module
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadOnceForChunkError()) e.preventDefault();
  });
}

// Bắt lỗi giao diện: thay vì màn hình trắng, hiện thông báo + nút thử lại
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (CHUNK_RE.test(error?.message ?? '') && reloadOnceForChunkError()) return;
    console.error('[ui]', error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    // Chuyển trang → thử hiển thị lại
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = CHUNK_RE.test(this.state.error?.message ?? '');
    return (
      <div role="alert" className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Nuti mood="sorry" size={120} />
        <h1 className="text-xl font-bold text-primary">{chunk ? 'NUTRIVA vừa có bản cập nhật' : 'Ối, có lỗi hiển thị'}</h1>
        <p className="max-w-xs text-base text-secondary">
          {chunk ? 'Tải lại để dùng phiên bản mới nhất nhé.' : 'Dữ liệu của bạn vẫn an toàn. Thử tải lại trang — nếu vẫn lỗi, hãy báo cho NUTRIVA qua mục Hỗ trợ.'}
        </p>
        <button type="button" className="flex h-12 items-center gap-2 rounded-full bg-brand-dark px-6 font-bold text-white" onClick={() => window.location.reload()}>
          <RefreshCw size={18} aria-hidden="true" /> Tải lại
        </button>
      </div>
    );
  }
}
