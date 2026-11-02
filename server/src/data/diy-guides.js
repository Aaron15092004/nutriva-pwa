// Hướng dẫn tự nấu từng gói hạt (theo tài liệu "hình minh họa" của NUTRIVA).
// Định dạng text: dòng bắt đầu "• " = gạch đầu dòng (phần trước dấu ":" in đậm); dòng "Cách N – …" = tiêu đề phụ.
const STORAGE = {
  title: 'Bước 3. Bảo quản',
  text: 'Làm nguội nhanh, cho vào bình sạch, đậy kín và bảo quản trong ngăn mát tủ lạnh với nhiệt độ ≤4°C. Hãy sử dụng sữa trong 3–4 ngày.',
};
const TUNE = 'Có thể lọc lại và tinh chỉnh độ ngọt của sữa tùy theo sở thích.';

const guide = (prep, machine, stove) => [
  { title: 'Bước 1. Sơ chế nguyên liệu', text: prep },
  { title: 'Bước 2. Chế biến sữa hạt', text: `Cách 1 – Dùng máy làm sữa hạt\n${machine} ${TUNE}\nCách 2 – Dùng máy xay và bếp\n${stove} ${TUNE}` },
  STORAGE,
];

export const DIY_GUIDES = {
  'mach-nhien': guide(
    '• Óc chó (40g) & Hạnh nhân (30g): Rửa sạch, ngâm chung trong nước sạch khoảng 2–4 giờ để làm mềm hạt. Bóc vỏ lụa tùy sở thích.\n• Yến mạch (30g): Không cần ngâm, cho trực tiếp vào khi nấu.\nSau khi ngâm, đổ bỏ nước ngâm và rửa lại hạt.',
    'Cho toàn bộ nguyên liệu cùng 1.000ml nước sạch vào máy. Chọn chế độ nấu sữa hạt và chờ hoàn tất.',
    'Xay nhuyễn toàn bộ nguyên liệu cùng 1.000ml nước. Đổ vào nồi, đun chín từ 15–20 phút và khuấy đều để tránh cháy đáy.',
  ),
  'sen-thanh': guide(
    '• Hạt sen (40g): Rửa sạch, ngâm 3–4 giờ để làm mềm.\n• Hạt điều (30g) & Hạt bí (30g): Rửa sạch, cho trực tiếp vào khi nấu.\nSau khi ngâm, đổ bỏ nước ngâm, rửa lại hạt sen.',
    'Cho nguyên liệu cùng 1.000ml nước sạch vào máy. Chọn chế độ nấu sữa hạt phù hợp, bảo đảm hạt sen chín mềm.',
    'Luộc hạt sen đến khi chín mềm. Xay nhuyễn cùng hạt điều, hạt bí và nước sạch (tổng lượng nước sử dụng 1.000ml). Đổ vào nồi, đun sôi nhẹ và khuấy đều khoảng 15–20 phút.',
  ),
  'lut-thanh': guide(
    '• Gạo lứt: Vo sạch, ngâm khoảng 2–4 giờ để hạt mềm hơn.\n• Hạnh nhân: Ngâm từ 2–4 giờ, bóc vỏ lụa tùy sở thích.\n• Hạt điều: Rửa sạch, cho trực tiếp vào khi nấu.\nSau khi ngâm, đổ bỏ nước và rửa lại nguyên liệu.',
    'Cho nguyên liệu cùng 1.000ml nước vào máy. Chọn chế độ nấu phù hợp với gạo và hạt khô, bảo đảm gạo chín hoàn toàn.',
    'Nấu gạo lứt đến khi chín mềm. Xay cùng hạnh nhân, hạt điều và nước sạch (tổng 1.000ml). Đổ vào nồi, đun sôi nhẹ khoảng 15–20 phút, khuấy đều.',
  ),
  'sen-com': guide(
    '• Hạt sen: Rửa sạch, ngâm 3–4 giờ để làm mềm.\n• Hạnh nhân: Ngâm khoảng 2–4 giờ để làm mềm, bóc vỏ lụa tùy sở thích.\n• Cốm: Không cần ngâm, cho trực tiếp vào khi nấu.\nSau khi ngâm, đổ bỏ nước và rửa lại nguyên liệu.',
    'Cho toàn bộ nguyên liệu cùng 1.000ml nước vào máy. Chọn chế độ nấu phù hợp, bảo đảm hạt sen chín mềm.',
    'Luộc hạt sen chín mềm. Xay cùng hạnh nhân, cốm và nước sạch (tổng 1.000ml). Đổ vào nồi, đun sôi nhẹ khoảng 15–20 phút, khuấy đều để tránh cháy đáy.',
  ),
  'huyen-moc': guide(
    '• Đậu đen: Rửa sạch, ngâm khoảng 6–8 giờ trong ngăn mát tủ lạnh.\n• Gạo lứt: Vo sạch, ngâm riêng khoảng 2–4 giờ.\n• Mè đen: Rửa sạch, không cần ngâm.\nĐổ bỏ nước ngâm và rửa lại nguyên liệu.',
    'Nấu chín mềm đậu đen và gạo lứt trước. Cho cùng mè đen và 1.000ml nước sạch vào máy, chọn chế độ nấu sữa hạt phù hợp.',
    'Nấu đậu đen và gạo lứt đến khi chín mềm. Xay nhuyễn cùng mè đen và nước sạch (tổng 1.000ml). Đổ vào nồi, đun sôi nhẹ khoảng 15–20 phút, khuấy đều.',
  ),
  'nau-moc': guide(
    '• Hạt điều: Rửa sạch, có thể ngâm khoảng 2 giờ để làm mềm.\n• Yến mạch cán dẹt & Bột cacao: Không cần ngâm, cho trực tiếp vào khi nấu.\nĐổ bỏ nước ngâm hạt điều, rửa sạch và để ráo.',
    'Cho toàn bộ nguyên liệu cùng 1.000ml nước vào máy. Chọn chế độ nấu sữa hạt và chờ hoàn tất.',
    'Xay nhuyễn hạt điều, yến mạch và cacao cùng 1.000ml nước. Đổ vào nồi, đun sôi nhẹ khoảng 15–20 phút, khuấy đều tránh cháy đáy.',
  ),
};
