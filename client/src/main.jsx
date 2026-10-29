import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { PwaProvider } from './context/PwaContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
// Font tự host (không phụ thuộc Google Fonts: tải nhanh hơn, chạy offline, hợp CSP). Trình duyệt chỉ tải bộ ký tự cần (latin, tiếng Việt).
import '@fontsource-variable/nunito-sans/opsz.css';
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource/dancing-script/vietnamese-600.css';
import '@fontsource/dancing-script/latin-600.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PwaProvider>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </PwaProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
