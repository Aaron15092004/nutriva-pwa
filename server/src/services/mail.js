// Gửi email giao dịch (đặt lại mật khẩu...). Có RESEND_API_KEY → gửi qua Resend (https://resend.com, gói miễn phí 3.000 mail/tháng);
// chưa cấu hình → in nội dung ra console (đủ để thử khi phát triển).
export const mailEnabled = () => Boolean(process.env.RESEND_API_KEY);

export async function sendMail({ to, subject, html, text }) {
  if (!mailEnabled()) {
    console.log(`[mail] (chưa cấu hình RESEND_API_KEY) → ${to}\n  ${subject}\n  ${text}`);
    return { ok: true, dev: true };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'NUTRIVA <onboarding@resend.dev>', to: [to], subject, html, text }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { ok: true };
}

// Địa chỉ app dùng trong link email. KHÔNG lấy từ header Origin/Host của request (kẻ xấu có thể giả để đánh cắp token).
export function appUrl() {
  const first = (process.env.CLIENT_ORIGIN ?? '').split(',')[0].trim();
  return (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || first || 'http://localhost:5173').replace(/\/$/, '');
}
