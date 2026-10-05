export const money = (n) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
export const num = (n, d = 0) => Number(n ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: d });

// Ngày theo giờ địa phương dạng YYYY-MM-DD
export const toISODate = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const today = () => toISODate(new Date());
export const parseDate = (s) => new Date(`${s}T00:00:00`);
export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

// Thứ Hai đầu tuần
export const weekStart = (s) => {
  const d = parseDate(s);
  const dow = (d.getDay() + 6) % 7;
  return addDays(s, -dow);
};

export const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const weekdayShort = (s) => WEEKDAY_SHORT[parseDate(s).getDay()];
export const dayNum = (s) => parseDate(s).getDate();

export const longDate = (s) => {
  const d = parseDate(s);
  const wd = d.getDay() === 0 ? 'Chủ nhật' : `Thứ ${d.getDay() + 1}`;
  return `${wd}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
};

export const dateTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
