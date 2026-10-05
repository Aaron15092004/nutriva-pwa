import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { squareImage } from '../../lib/image.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Sheet } from '../ui.jsx';
import { Avatar } from '../ds/index.jsx';

// Ảnh đại diện có thể đổi: bấm vào → chọn ảnh mới / xóa ảnh
export default function AvatarPicker({ user, onChange, size = 64 }) {
  const toast = useToast();
  const input = useRef(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setOpen(false);
    setBusy(true);
    try {
      const blob = await squareImage(file);
      const d = await api.upload('/auth/me/avatar', blob, 'file', 'avatar.webp');
      onChange(d.user);
      toast('Đã cập nhật ảnh đại diện');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setOpen(false);
    setBusy(true);
    try {
      onChange((await api.del('/auth/me/avatar')).user);
      toast('Đã xóa ảnh đại diện');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Đổi ảnh đại diện"
        className="relative shrink-0 rounded-full shadow-pill transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-dark"
        style={{ width: size, height: size }}
      >
        <Avatar src={user.avatar} name={user.name} size={size} />
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white">
            <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          </span>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-teal-dark text-white" aria-hidden="true">
          <Camera size={12} strokeWidth={2.5} />
        </span>
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />

      <Sheet open={open} onClose={() => setOpen(false)} title="Ảnh đại diện">
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => input.current?.click()} className="flex min-h-14 items-center gap-4 rounded-lg bg-white px-4 text-left text-base font-semibold text-primary shadow-card">
            <ImagePlus size={22} className="text-teal-dark" aria-hidden="true" /> Chọn ảnh mới
          </button>
          {user.avatar && (
            <button type="button" onClick={remove} className="flex min-h-14 items-center gap-4 rounded-lg bg-white px-4 text-left text-base font-semibold text-warm-dark shadow-card">
              <Trash2 size={22} aria-hidden="true" /> Xóa ảnh hiện tại
            </button>
          )}
          <p className="pt-2 text-xs text-muted">Ảnh được cắt vuông và thu nhỏ trước khi tải lên. Hỗ trợ PNG, JPG, WebP.</p>
        </div>
      </Sheet>
    </>
  );
}
