# Kết nối MongoDB Atlas

1. Đăng nhập https://cloud.mongodb.com → **Create** một cluster (gói M0 miễn phí là đủ để chạy thử).
2. **Database Access** → *Add New Database User*: đặt username/mật khẩu, quyền *Read and write to any database*.
3. **Network Access** → *Add IP Address*:
   - Chạy trên máy: *Add Current IP Address*.
   - Deploy lên Render/Railway/VPS…: thêm IP của server, hoặc `0.0.0.0/0` (mọi IP — chỉ nên dùng khi mật khẩu DB đủ mạnh).
4. **Database** → *Connect* → *Drivers* → sao chép chuỗi kết nối, thêm tên database `nutriva` trước dấu `?`:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/nutriva?retryWrites=true&w=majority&appName=Cluster0
   ```

5. Dán vào `server/.env`:

   ```
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=<chuỗi ngẫu nhiên dài>
   ADMIN_EMAILS=email-cua-ban@example.com
   ```

6. Chạy `npm run dev` (hoặc `npm start` sau khi build). Lần đầu kết nối, server tự nạp dữ liệu mẫu
   (sản phẩm, 638 thực phẩm, 109 món ăn, 12 kế hoạch ăn mẫu, 81 hoạt động) nếu collection còn trống.

## Nạp lại dữ liệu

- `npm run import-foods -w server` — thay bảng thực phẩm + món ăn và cập nhật kế hoạch mẫu (giữ thực đơn tự tạo của người dùng).
- `npm run create-admin -w server -- <email> <mật khẩu> [tên]` — tạo/thăng quyền admin.

> Không commit `server/.env`. Nếu lỡ chia sẻ mật khẩu DB, đổi mật khẩu trong **Database Access** rồi cập nhật lại `MONGODB_URI`.
