import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../lib/api.js';
import { clearApiCache } from '../lib/useApi.js';
import { clearOutbox } from '../lib/outbox.js';
import { anonId } from '../lib/track.js';

const AuthContext = createContext(null);
const USER_KEY = 'nutriva_user';

// Lưu bản sao hồ sơ trên máy: mở app khi mất mạng / máy chủ đang khởi động vẫn vào được, không bị đá ra màn hình chào
const cacheUser = (u) => {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* bộ nhớ bị chặn */
  }
};
const cachedUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [ready, setReady] = useState(false);

  const setUser = useCallback((u) => {
    setUserState(u);
    cacheUser(u);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    clearApiCache();
    clearOutbox();
    cacheUser(null);
    // Giỏ hàng & dữ liệu tạm của tài khoản cũ không được sang tài khoản khác
    window.dispatchEvent(new Event('nutriva:session-end'));
    setUserState(null);
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) {
      setReady(true);
      return;
    }
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch((e) => {
        if (e.status === 401) logout();
        else setUserState(cachedUser()); // mất mạng / 503: dùng hồ sơ đã lưu, đồng bộ lại sau
      })
      .finally(() => setReady(true));
  }, [setUser, logout]);

  useEffect(() => {
    window.addEventListener('nutriva:logout', logout);
    return () => window.removeEventListener('nutriva:logout', logout);
  }, [logout]);

  const value = useMemo(() => {
    const signIn = (d) => {
      clearApiCache();
      tokenStore.set(d.token);
      setUser(d.user);
      return d.user;
    };
    return {
      user,
      ready,
      setUser,
      async login(email, password) {
        return signIn(await api.post('/auth/login', { email, password }));
      },
      // Đăng nhập/đăng ký bằng Google: credential = ID token từ Google Identity Services.
      // Tài khoản chưa tồn tại & không gửi kèm hồ sơ → lỗi 404 code NEEDS_ONBOARDING.
      async loginWithGoogle(credential, extra = {}) {
        return signIn(await api.post('/auth/google', { credential, anon: anonId(), ...extra }));
      },
      async register(payload) {
        return signIn(await api.post('/auth/register', { anon: anonId(), ...payload }));
      },
      // Đặt lại mật khẩu từ link email → đăng nhập luôn
      async resetPassword(token, password) {
        return signIn(await api.post('/auth/reset', { token, password }));
      },
      // Đổi mật khẩu / đăng xuất thiết bị khác: server cấp token mới cho thiết bị này
      replaceToken(token) {
        if (token) tokenStore.set(token);
      },
      async update(patch) {
        const d = await api.patch('/auth/me', patch);
        setUser(d.user);
        return d.user;
      },
      logout,
    };
  }, [user, ready, logout, setUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
