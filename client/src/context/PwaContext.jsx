import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const PwaContext = createContext(null);
const INSTALLED_KEY = 'nutriva_app_installed';

// Đang chạy trong ứng dụng đã cài (không phải tab trình duyệt)
const APP_MODES = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
const appQueries = () => APP_MODES.map((m) => window.matchMedia(`(display-mode: ${m})`));
const isStandalone = () =>
  appQueries().some((q) => q.matches) || window.navigator.standalone === true || document.referrer.startsWith('android-app://');

const UA = navigator.userAgent;
const isIOS = () => /iphone|ipad|ipod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /android/i.test(UA);
// Trên iOS chỉ Safari thêm được web app vào màn hình chính (Chrome/Firefox/Edge iOS, Zalo, Facebook… thì không chắc chắn)
const isIOSSafari = () => isIOS() && /safari/i.test(UA) && !/crios|fxios|edgios|opios|gsa\/|fban|fbav|instagram|zalo|line\/|micromessenger|tiktok/i.test(UA);

const readFlag = () => {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
};
const writeFlag = () => {
  try {
    localStorage.setItem(INSTALLED_KEY, '1');
  } catch {
    /* bộ nhớ bị chặn */
  }
};

// Quản lý mục "Cài đặt ứng dụng":
// - installed: đang mở trong app đã cài → ẩn mọi lời mời cài đặt.
// - Trên web luôn hiện; nếu thiết bị đã cài app (installedOnDevice) thì nút hướng dẫn mở app thay vì cài lại.
// - Android: bấm là hiện hộp thoại cài của hệ thống (beforeinstallprompt); trình duyệt chưa hỗ trợ thì hướng dẫn qua menu.
// - iOS: Safari → hướng dẫn Chia sẻ › Thêm vào MH chính; trình duyệt khác/in-app → hướng dẫn mở bằng Safari trước.
export function PwaProvider({ children }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [installedOnDevice, setInstalledOnDevice] = useState(() => isStandalone() || readFlag());
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (installed) writeFlag();
  }, [installed]);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      // Trình duyệt chỉ mời cài khi app CHƯA được cài → bỏ dấu "đã cài" cũ (vd người dùng đã gỡ app)
      setInstalledOnDevice(isStandalone());
      try {
        localStorage.removeItem(INSTALLED_KEY);
      } catch {
        /* bộ nhớ bị chặn */
      }
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalledOnDevice(true);
      writeFlag();
    };
    // Chuyển giữa tab trình duyệt và cửa sổ app (vd Chrome "Mở trong ứng dụng")
    const onMode = () => setInstalled(isStandalone());
    const queries = appQueries();
    queries.forEach((q) => q.addEventListener('change', onMode));
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      queries.forEach((q) => q.removeEventListener('change', onMode));
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const value = useMemo(
    () => ({
      installed,
      installedOnDevice,
      // Chỉ mời cài trên điện thoại/máy tính bảng (Android, iOS); máy tính không hiện mục cài đặt
      showInstall: !installed && (isAndroid() || isIOS()),
      canPrompt: Boolean(deferred),
      ios: isIOS(),
      iosSafari: isIOSSafari(),
      android: isAndroid(),
      guideOpen,
      closeGuide: () => setGuideOpen(false),
      async install() {
        if (deferred) {
          deferred.prompt();
          const { outcome } = await deferred.userChoice;
          setDeferred(null);
          if (outcome === 'accepted') {
            setInstalledOnDevice(true);
            writeFlag();
          }
          return;
        }
        setGuideOpen(true);
      },
    }),
    [deferred, installed, installedOnDevice, guideOpen],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export const usePwa = () => useContext(PwaContext);
