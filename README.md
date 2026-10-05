# NUTRIVA — Web app PWA dinh dưỡng

Sữa hạt tươi • Set tự làm • Kế hoạch dinh dưỡng cá nhân.
React (Vite) + Node.js (Express) + MongoDB Atlas. Cài đặt được lên màn hình chính như ứng dụng (PWA).

## Cấu trúc

```
client/            React + Vite + vite-plugin-pwa
  src/pages/       App người dùng (mobile-first)
  src/admin/       Trang quản trị /admin (desktop, lazy-load)
  public/push-sw.js  Xử lý Web Push trong service worker
server/            Express + Mongoose + JWT
  src/routes/      auth, plan, logs, shop, care (nhắc nhở, push, trợ lý, hỗ trợ), admin
  src/services/    plan, claude (trợ lý AI), push, scheduler, catalog
  src/data/        Dữ liệu khởi tạo (chỉ nạp khi DB trống)
shared/            Công thức dinh dưỡng dùng chung (BMI, WHtR, BMR, TDEE, macro…)
docs/              Hướng dẫn MongoDB Atlas
```

## Chạy

```bash
npm install
cp server/.env.example server/.env   # điền MONGODB_URI, JWT_SECRET, ADMIN_EMAILS (xem docs/MONGODB_ATLAS.md)
npm run dev                          # API :5000 + web :5173
```

Tạo admin: đăng ký bằng email trong `ADMIN_EMAILS`, hoặc
`npm run create-admin -w server -- <email> <mật khẩu> [tên]` → mở `/admin`.

> Khi phát triển, nếu để trống `MONGODB_URI`, server dùng MongoDB tạm trong bộ nhớ (mất dữ liệu khi tắt). Production bắt buộc có Atlas.

Build & chạy 1 server: `npm run build && npm start` (Express phục vụ cả API và `client/dist`).
Nhắc nhở đẩy (Web Push) cần bản build (service worker) và HTTPS hoặc `localhost`.

## Biến môi trường (`server/.env`)

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `MONGODB_URI` | ✔ (production) | Chuỗi kết nối Atlas |
| `JWT_SECRET` | ✔ (production) | Khóa ký phiên đăng nhập |
| `ADMIN_EMAILS` | | Email tự động có quyền admin |
| `ANTHROPIC_API_KEY` | | Bật Trợ lý NUTRIVA dùng Claude (`claude-opus-5-5`). Trống → trả lời theo từ khóa |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | | Khóa Web Push; trống → tự tạo và lưu vào DB |
| `APP_TZ` | | Múi giờ cho nhắc nhở & gói định kỳ (mặc định `Asia/Ho_Chi_Minh`) |
| `SCHEDULER=off` | | Tắt bộ lập lịch trên instance phụ khi chạy nhiều server |

## Tính năng thật (không mock)

- **Tài khoản:** đăng ký/đăng nhập JWT, đổi mật khẩu, xuất & xóa dữ liệu, phân quyền admin.
- **Chỉ số & kế hoạch:** BMI, WHtR, BMR (Mifflin–St Jeor), TDEE; kế hoạch ngày/tuần sinh từ món ăn trong DB, lọc dị ứng/chế độ ăn, đổi món lưu DB.
- **Nhật ký:** ghi món theo gram (thực phẩm trong DB), nước, vận động (MET), cảm nhận.
- **Cửa hàng:** sản phẩm/giá/tồn kho từ DB; mã giảm giá có hạn dùng, số lượt, đơn tối thiểu, chỉ đơn đầu; phí ship cấu hình; COD hoặc chuyển khoản **VietQR** theo tài khoản admin cấu hình; hủy đơn hoàn kho.
- **Gói định kỳ:** server tự tạo đơn lúc 6:00 mỗi ngày giao, chia đều số chai, chống tạo trùng.
- **Nhắc nhở:** server gửi **Web Push** đúng giờ (kể cả khi đóng app); thông báo khi admin đổi trạng thái đơn/phản hồi hỗ trợ.
- **Trợ lý NUTRIVA:** Claude API, có ngữ cảnh hồ sơ, chỉ số, kế hoạch & nhật ký hôm nay và danh mục sản phẩm an toàn; giữ lịch sử hội thoại.
- **Hỗ trợ:** khách gửi yêu cầu, admin phản hồi, khách xem phản hồi trong app.

## Trang Admin (`/admin`)

Tổng quan (doanh thu 14 ngày, bán chạy, việc cần xử lý) • Đơn hàng (lọc, đổi trạng thái, xác nhận thanh toán, ghi chú) • Sản phẩm (CRUD, upload ảnh lưu GridFS, tồn kho, hướng dẫn DIY) • Thực phẩm • Món ăn kế hoạch • Mã giảm giá • Người dùng (vai trò, đặt lại mật khẩu, xóa) • Gói định kỳ (bật/tắt, tạo đơn ngay) • Hỗ trợ (phản hồi) • Cài đặt (phí ship, ngân hàng VietQR, cửa hàng, gói định kỳ, hướng dẫn DIY mặc định).

## Công thức

| Chỉ số | Công thức |
|---|---|
| BMR | Nam: 10×kg + 6,25×cm − 5×tuổi + 5 · Nữ: … − 161 |
| TDEE | BMR × R (1,2 / 1,375 / 1,55 / 1,725) |
| WHtR | Vòng eo / Chiều cao |
| Calo mục tiêu | Duy trì = TDEE · Giảm = TDEE − 500 (≥ BMR) · Tăng = TDEE + 300 |
| Nước | ≈ 35 ml × cân nặng |
| Vận động | kcal = MET × kg × giờ |
