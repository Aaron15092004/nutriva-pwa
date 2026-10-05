import { readFileSync } from 'node:fs';

// Kế hoạch ăn mẫu 7 ngày (4 bữa/ngày). Mỗi bữa gồm thực phẩm (bảng thực phẩm, theo gram) hoặc món ăn (bảng món, theo khẩu phần).
// Định lượng được tự cân lại cho khớp mức calo của từng kế hoạch: tinh bột & món đạm co giãn, rau/trái cây giữ nguyên.
// Dinh dưỡng KHÔNG lưu sẵn — luôn tính lại từ bảng thực phẩm khi đọc (services/meal-plans.js).

// Ảnh bìa (Wikimedia Commons, giấy phép mở) — tác giả & giấy phép
const IMAGE_CREDITS = JSON.parse(readFileSync(new URL('./plan-images.json', import.meta.url), 'utf8'));

const MEAL_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

// F: thực phẩm (key, gram gốc, nhãn hiển thị, ghi chú định lượng, bước làm tròn)
const F = (food, grams, label, note, step = 5) => ({ food, grams, label, note, step });
// D: món ăn có sẵn công thức (khẩu phần 1 = đúng công thức)
const D = (dish) => ({ dish, portion: 1 });

// Mỗi bữa = danh sách "ô"; mỗi ô có role (base/main co giãn, side cố định) và các lựa chọn xoay vòng theo ngày
const slot = (role, ...options) => ({ role, options });

const FRUIT = [F('chuoi-tieu', 100, 'Chuối tiêu'), F('tao-tay', 150, 'Táo tây'), F('cam', 150, 'Cam'), F('du-du-chin', 150, 'Đu đủ chín'), F('qua-thanh-long', 150, 'Thanh long'), F('oi', 120, 'Ổi'), F('qua-kiwi', 80, 'Kiwi'), F('le', 150, 'Lê'), F('dua-hau', 200, 'Dưa hấu'), F('xoai-chin', 120, 'Xoài chín')];
const BERRY = [F('viet-quat', 50, 'Việt quất'), F('dau-tay', 100, 'Dâu tây'), F('luu', 80, 'Lựu'), F('qua-kiwi', 80, 'Kiwi'), F('nho-ngot', 80, 'Nho'), F('cam', 150, 'Cam'), F('man-tim', 100, 'Mận')];
const GREEN = [F('sup-lo-xanh', 150, 'Súp lơ xanh luộc'), F('cai-thia', 150, 'Cải thìa luộc'), F('mang-tay', 120, 'Măng tây áp chảo'), F('dau-co-ve', 150, 'Đậu cô ve luộc'), F('rau-muong', 150, 'Rau muống luộc'), F('bi-ngoi', 150, 'Bí ngòi xào tỏi'), F('cai-xanh', 150, 'Cải xanh luộc')];
const SALAD = [F('xa-lach', 80, 'Xà lách trộn'), F('ca-chua', 100, 'Cà chua bi'), F('dua-chuot', 120, 'Dưa chuột'), F('ca-rot', 80, 'Cà rốt luộc'), F('cai-bap-tim', 80, 'Bắp cải tím trộn'), F('ot-chuong', 80, 'Ớt chuông nướng'), F('bi-do', 120, 'Bí đỏ hấp')];
const CANH = [F('rau-ngot', 100, 'Canh rau ngót'), F('bi-xanh', 150, 'Canh bí xanh'), F('rau-mong-toi', 120, 'Canh mồng tơi'), F('cai-xanh', 120, 'Canh cải xanh'), F('muop', 150, 'Canh mướp'), F('bau', 150, 'Canh bầu'), F('rau-den-com', 120, 'Canh rau dền')];

export const PATTERNS = {
  // Eat clean: ngũ cốc nguyên hạt, đạm nạc, nhiều rau
  'eat-clean': {
    breakfast: [
      slot('base', F('yen-mach', 40, 'Yến mạch nấu sữa hạt'), F('banh-mi-nguyen-cam', 60, 'Bánh mì nguyên cám'), F('khoai-lang', 150, 'Khoai lang luộc'), F('ngo-nep-luoc', 150, 'Ngô nếp luộc'), F('yen-mach', 40, 'Cháo yến mạch'), F('banh-mi-nguyen-cam', 60, 'Bánh mì nguyên cám nướng'), F('khoai-lang-nghe', 150, 'Khoai lang nghệ hấp')),
      slot('main', F('trung-ga', 100, 'Trứng gà luộc', '2 quả', 50), F('sua-chua-it-duong', 100, 'Sữa chua ít đường'), F('trung-ga', 100, 'Trứng gà ốp la ít dầu', '2 quả', 50), F('sua-hat-nutriva', 250, 'Sữa hạt NUTRIVA', null, 10), F('trung-ga', 50, 'Trứng gà luộc', '1 quả', 50), F('sua-dau-nanh-100g-lit', 250, 'Sữa đậu nành không đường', null, 10), F('sua-chua-it-duong', 100, 'Sữa chua ít đường')),
      slot('side', ...BERRY),
    ],
    lunch: [
      slot('base', F('gao-lut', 60, 'Cơm gạo lứt', 'gạo khô'), F('gao-lut-huyet-rong', 60, 'Cơm gạo lứt huyết rồng', 'gạo khô'), F('khoai-lang', 200, 'Khoai lang nướng'), F('gao-lut', 60, 'Cơm gạo lứt', 'gạo khô'), F('bun', 150, 'Bún tươi'), F('gao-lut-huyet-rong', 60, 'Cơm gạo lứt huyết rồng', 'gạo khô'), F('khoai-tay', 200, 'Khoai tây nướng')),
      slot('main', F('thit-ga-luon', 150, 'Ức gà áp chảo'), F('ca-basa-phi-le', 180, 'Cá basa hấp gừng'), F('thit-bo-than', 120, 'Bò thăn xào hành tây'), F('tom-bien', 150, 'Tôm luộc'), F('ca-hoi', 120, 'Cá hồi áp chảo'), F('dau-phu', 200, 'Đậu phụ sốt cà chua'), F('thit-ga-luon', 150, 'Ức gà rô ti')),
      slot('side', ...GREEN),
      slot('side', ...SALAD),
    ],
    dinner: [
      slot('base', F('khoai-lang', 150, 'Khoai lang luộc'), F('gao-lut', 50, 'Cơm gạo lứt', 'gạo khô'), F('bi-do', 200, 'Bí đỏ hấp'), F('ngo-nep-luoc', 150, 'Ngô nếp luộc'), F('gao-lut', 50, 'Cơm gạo lứt', 'gạo khô'), F('khoai-lang-nghe', 150, 'Khoai lang nghệ hấp'), F('gao-lut-huyet-rong', 50, 'Cơm gạo lứt huyết rồng', 'gạo khô')),
      slot('main', F('ca-dieu-hong', 180, 'Cá diêu hồng hấp'), F('thit-ga-luon', 150, 'Ức gà luộc xé'), F('muc-tuoi', 180, 'Mực hấp gừng'), F('thit-bo-nac', 120, 'Bò áp chảo'), F('dau-phu', 200, 'Đậu phụ non hấp nấm'), F('tom-bien', 150, 'Tôm hấp sả'), F('ca-ngu', 150, 'Cá ngừ áp chảo')),
      slot('side', ...GREEN.slice(3), ...GREEN.slice(0, 3)),
    ],
    snack: [
      slot('main', F('sua-chua-it-duong', 100, 'Sữa chua ít đường'), F('hanh-nhan', 15, 'Hạnh nhân'), F('hat-dieu', 15, 'Hạt điều'), F('sua-hat-nutriva', 200, 'Sữa hạt NUTRIVA', null, 10), F('hat-bi', 15, 'Hạt bí'), F('sua-chua-it-duong', 100, 'Sữa chua ít đường'), F('hanh-nhan', 15, 'Hạnh nhân')),
      slot('side', ...FRUIT),
    ],
  },

  // Cân bằng, giàu chất chống oxy hóa: nhiều rau củ, trái cây đậm màu
  balanced: {
    breakfast: [
      slot('base', F('yen-mach', 40, 'Yến mạch ngâm qua đêm'), F('banh-mi-nguyen-cam', 60, 'Bánh mì nguyên cám'), F('khoai-lang', 150, 'Khoai lang tím hấp'), F('yen-mach', 40, 'Yến mạch nấu sữa'), F('banh-mi-nguyen-cam', 60, 'Bánh mì nguyên cám'), F('ngo-nep-luoc', 150, 'Ngô nếp luộc'), F('gao-lut-huyet-rong', 40, 'Cháo gạo lứt huyết rồng', 'gạo khô')),
      slot('main', F('sua-chua-it-duong', 100, 'Sữa chua ít đường'), F('trung-ga', 100, 'Trứng gà luộc', '2 quả', 50), F('sua-hat-nutriva', 250, 'Sữa hạt NUTRIVA', null, 10), F('trung-ga', 50, 'Trứng gà ốp la', '1 quả', 50), F('sua-chua-it-duong', 100, 'Sữa chua ít đường'), F('sua-dau-nanh-100g-lit', 250, 'Sữa đậu nành', null, 10), F('trung-ga', 100, 'Trứng gà luộc', '2 quả', 50)),
      slot('side', ...BERRY),
      slot('side', F('hat-chia', 10, 'Hạt chia'), F('qua-bo', 50, 'Bơ chín'), F('hat-lanh', 10, 'Hạt lanh'), F('hanh-nhan', 10, 'Hạnh nhân'), F('hat-chia', 10, 'Hạt chia'), F('qua-bo', 50, 'Bơ chín'), F('vung-den-me-den', 10, 'Mè đen rang')),
    ],
    lunch: [
      slot('base', F('gao-lut', 60, 'Cơm gạo lứt', 'gạo khô'), F('gao-te', 60, 'Cơm trắng', 'gạo khô'), F('gao-lut-huyet-rong', 60, 'Cơm gạo lứt huyết rồng', 'gạo khô'), F('bun', 150, 'Bún tươi'), F('gao-lut', 60, 'Cơm gạo lứt', 'gạo khô'), F('khoai-lang', 200, 'Khoai lang nướng'), F('gao-te', 60, 'Cơm trắng', 'gạo khô')),
      slot('main', F('ca-hoi', 120, 'Cá hồi nướng'), F('thit-ga-luon', 150, 'Gà nướng mật ong'), F('thit-bo-than', 120, 'Bò xào bông cải'), F('tom-bien', 150, 'Tôm xào rau củ'), F('ca-thu', 120, 'Cá thu sốt cà chua'), F('dau-phu', 200, 'Đậu phụ sốt nấm'), F('thit-lon-nac', 120, 'Thịt nạc rim tiêu')),
      slot('side', F('ca-rot', 100, 'Cà rốt xào'), F('sup-lo-xanh', 150, 'Súp lơ xanh luộc'), F('cai-bap-tim', 100, 'Bắp cải tím trộn'), F('bi-do', 150, 'Bí đỏ hấp'), F('ot-chuong', 100, 'Ớt chuông xào'), F('rau-ngot', 120, 'Canh rau ngót'), F('ca-chua', 120, 'Cà chua bi')),
      slot('side', ...GREEN),
    ],
    dinner: [
      slot('base', F('gao-lut', 50, 'Cơm gạo lứt', 'gạo khô'), F('khoai-lang', 150, 'Khoai lang hấp'), F('gao-te', 50, 'Cơm trắng', 'gạo khô'), F('bi-do', 200, 'Súp bí đỏ'), F('gao-lut', 50, 'Cơm gạo lứt', 'gạo khô'), F('mien-dong', 40, 'Miến dong trộn', 'miến khô'), F('khoai-tay', 200, 'Khoai tây nghiền')),
      slot('main', F('ca-dieu-hong', 180, 'Cá diêu hồng hấp xì dầu'), F('thit-ga-dui', 150, 'Đùi gà nướng bỏ da'), F('dau-phu', 200, 'Đậu phụ non hấp'), F('ca-basa-phi-le', 180, 'Cá basa áp chảo'), F('trung-ga', 100, 'Trứng hấp nấm', '2 quả', 50), F('muc-tuoi', 180, 'Mực xào cần tây'), F('thit-bo-nac', 120, 'Bò lúc lắc')),
      slot('side', ...SALAD),
      slot('side', ...CANH),
    ],
    snack: [
      slot('main', F('sua-chua-it-duong', 100, 'Sữa chua ít đường'), F('hat-dieu', 15, 'Hạt điều'), F('hanh-nhan', 15, 'Hạnh nhân'), F('sua-hat-nutriva', 200, 'Sữa hạt NUTRIVA', null, 10), F('oc-cho', 15, 'Óc chó'), F('sua-chua-it-duong', 100, 'Sữa chua ít đường'), F('hat-bi', 15, 'Hạt bí')),
      slot('side', ...BERRY.slice(2), ...BERRY.slice(0, 2)),
    ],
  },

  // Ít tinh bột – tăng đạm: đạm nạc mỗi bữa, tinh bột phức hợp lượng vừa phải
  'high-protein': {
    breakfast: [
      slot('main', F('trung-ga', 150, 'Trứng gà luộc', '3 quả', 50), F('trung-ga', 150, 'Trứng ốp la ít dầu', '3 quả', 50), F('sua-chua-it-duong', 200, 'Sữa chua ít đường'), F('trung-ga', 100, 'Trứng cuộn rau', '2 quả', 50), F('thit-ga-luon', 100, 'Ức gà xé'), F('trung-ga', 150, 'Trứng gà luộc', '3 quả', 50), F('sua-chua-it-duong', 200, 'Sữa chua ít đường')),
      slot('base', F('banh-mi-nguyen-cam', 50, 'Bánh mì nguyên cám'), F('yen-mach', 40, 'Yến mạch'), F('khoai-lang', 150, 'Khoai lang luộc'), F('banh-mi-nguyen-cam', 50, 'Bánh mì nguyên cám'), F('yen-mach', 40, 'Cháo yến mạch'), F('khoai-lang', 150, 'Khoai lang luộc'), F('banh-mi-nguyen-cam', 50, 'Bánh mì nguyên cám')),
      slot('side', F('sua-bo-it-beo', 250, 'Sữa bò ít béo', null, 10), F('sua-hat-nutriva', 250, 'Sữa hạt NUTRIVA', null, 10), F('sua-dau-nanh-100g-lit', 250, 'Sữa đậu nành không đường', null, 10), F('sua-bo-it-beo', 250, 'Sữa bò ít béo', null, 10), F('sua-hat-nutriva', 250, 'Sữa hạt NUTRIVA', null, 10), F('sua-dau-nanh-100g-lit', 250, 'Sữa đậu nành không đường', null, 10), F('sua-bo-it-beo', 250, 'Sữa bò ít béo', null, 10)),
    ],
    lunch: [
      slot('main', F('thit-ga-luon', 200, 'Ức gà rô ti'), F('thit-bo-than', 180, 'Bò thăn áp chảo'), F('ca-hoi', 160, 'Cá hồi áp chảo'), F('tom-bien', 200, 'Tôm hấp sả'), F('thit-ga-luon', 200, 'Ức gà nướng tiêu'), F('ca-ngu', 200, 'Cá ngừ áp chảo'), F('thit-bo-nac', 180, 'Bò xào tiêu đen')),
      slot('base', F('gao-lut', 50, 'Cơm gạo lứt', 'gạo khô'), F('khoai-lang', 150, 'Khoai lang nướng'), F('gao-lut-huyet-rong', 50, 'Cơm gạo lứt đỏ', 'gạo khô'), F('khoai-tay', 150, 'Khoai tây nướng'), F('gao-lut', 50, 'Cơm gạo lứt', 'gạo khô'), F('khoai-lang', 150, 'Khoai lang nướng'), F('gao-lut-huyet-rong', 50, 'Cơm gạo lứt đỏ', 'gạo khô')),
      slot('side', ...GREEN),
      slot('side', ...FRUIT.slice(3), ...FRUIT.slice(0, 3)),
    ],
    dinner: [
      slot('main', F('ca-basa-phi-le', 200, 'Cá basa áp chảo'), F('thit-ga-dui', 180, 'Đùi gà nướng bỏ da'), F('muc-tuoi', 200, 'Mực hấp'), F('thit-bo-nac', 160, 'Bò xào súp lơ'), F('dau-phu', 250, 'Đậu phụ sốt cà'), F('ca-dieu-hong', 200, 'Cá diêu hồng hấp'), F('tom-bien', 200, 'Tôm rang ít dầu')),
      slot('base', F('khoai-lang', 120, 'Khoai lang luộc'), F('gao-lut', 40, 'Cơm gạo lứt', 'gạo khô'), F('bi-do', 150, 'Bí đỏ hấp'), F('khoai-lang', 120, 'Khoai lang luộc'), F('gao-lut', 40, 'Cơm gạo lứt', 'gạo khô'), F('ngo-nep-luoc', 120, 'Ngô nếp luộc'), F('gao-lut', 40, 'Cơm gạo lứt', 'gạo khô')),
      slot('side', ...SALAD),
      slot('side', ...GREEN.slice(4), ...GREEN.slice(0, 4)),
    ],
    snack: [
      slot('main', F('sua-chua-it-duong', 150, 'Sữa chua ít đường'), F('trung-ga', 100, 'Trứng gà luộc', '2 quả', 50), F('hanh-nhan', 20, 'Hạnh nhân'), F('sua-bo-it-beo', 250, 'Sữa bò ít béo', null, 10), F('hat-bi', 20, 'Hạt bí'), F('sua-chua-it-duong', 150, 'Sữa chua ít đường'), F('dau-phu', 150, 'Đậu phụ non')),
      slot('side', ...BERRY),
    ],
  },

  // Thuần chay: đạm từ đậu, đậu phụ, hạt; sữa thực vật
  plant: {
    breakfast: [
      slot('base', F('yen-mach', 40, 'Yến mạch nấu sữa đậu nành'), F('banh-mi-nguyen-cam', 60, 'Bánh mì nguyên cám'), F('khoai-lang', 150, 'Khoai lang luộc'), D('bun-tron-dau-phu-chay'), F('yen-mach', 40, 'Yến mạch ngâm qua đêm'), D('xoi-gao-lut-huyet-rong-muoi-vung'), F('ngo-nep-luoc', 150, 'Ngô nếp luộc')),
      slot('main', F('sua-dau-nanh-100g-lit', 250, 'Sữa đậu nành', null, 10), F('qua-bo', 60, 'Bơ dằm'), F('sua-hat-nutriva', 250, 'Sữa hạt NUTRIVA', null, 10), F('sua-dau-nanh-100g-lit', 200, 'Sữa đậu nành', null, 10), F('hat-chia', 10, 'Hạt chia'), F('sua-hat-nutriva', 250, 'Sữa hạt NUTRIVA', null, 10), F('sua-dau-nanh-100g-lit', 250, 'Sữa đậu nành', null, 10)),
      slot('side', ...FRUIT),
    ],
    lunch: [
      slot('base', F('gao-lut', 60, 'Cơm gạo lứt', 'gạo khô'), F('gao-lut-huyet-rong', 60, 'Cơm gạo lứt huyết rồng', 'gạo khô'), F('bun', 150, 'Bún tươi'), F('gao-lut', 60, 'Cơm gạo lứt', 'gạo khô'), F('mien-dong', 50, 'Miến xào', 'miến khô'), F('gao-lut-huyet-rong', 60, 'Cơm gạo lứt huyết rồng', 'gạo khô'), F('khoai-lang', 200, 'Khoai lang nướng')),
      slot('main', F('dau-phu', 200, 'Đậu phụ sốt cà chua'), F('do-den', 50, 'Đỗ đen hầm', 'hạt khô'), F('dau-phu', 200, 'Đậu phụ kho nấm'), F('dau-phu-nuong', 150, 'Đậu phụ nướng sả'), F('dau-trang', 50, 'Đậu trắng hầm rau củ', 'hạt khô'), F('dau-phu', 200, 'Đậu phụ chiên sả ít dầu'), F('do-xanh', 50, 'Chè đỗ xanh không đường', 'hạt khô')),
      slot('side', F('nam-rom', 120, 'Nấm rơm xào'), F('nam-huong-tuoi', 100, 'Nấm hương xào'), F('nam-kim-cham', 100, 'Nấm kim châm áp chảo'), F('nam-mo', 120, 'Nấm mỡ xào'), F('nam-rom', 120, 'Canh nấm rơm'), F('nam-huong-tuoi', 100, 'Nấm hương kho'), F('nam-kim-cham', 100, 'Nấm kim châm hấp')),
      slot('side', ...GREEN),
    ],
    dinner: [
      slot('base', D('dau-phu-non-hap-nam-com-gao-lut'), D('mien-xao-chay-rau-nam'), F('gao-lut', 50, 'Cơm gạo lứt', 'gạo khô'), D('com-gao-lut-huyet-rong-dau-phu-sot-nam'), F('khoai-lang', 150, 'Khoai lang hấp'), F('gao-lut', 50, 'Cơm gạo lứt', 'gạo khô'), D('dau-phu-non-hap-nam-com-gao-lut')),
      slot('main', F('dau-phu', 100, 'Đậu phụ non'), F('dau-phu-nuong', 100, 'Đậu phụ nướng'), F('dau-phu', 200, 'Đậu phụ hấp hành'), F('do-den', 30, 'Chè đỗ đen không đường', 'hạt khô'), F('dau-phu', 200, 'Đậu phụ sốt nấm'), F('dau-phu-nuong', 150, 'Đậu phụ nướng mè'), F('hat-dieu', 20, 'Hạt điều rang')),
      slot('side', ...SALAD),
      slot('side', ...CANH),
    ],
    snack: [
      slot('main', F('hat-dieu', 15, 'Hạt điều'), F('sua-dau-nanh-100g-lit', 200, 'Sữa đậu nành', null, 10), F('hanh-nhan', 15, 'Hạnh nhân'), F('hat-bi', 15, 'Hạt bí'), F('sua-hat-nutriva', 200, 'Sữa hạt NUTRIVA', null, 10), F('oc-cho', 15, 'Óc chó'), F('hat-huong-duong', 15, 'Hạt hướng dương')),
      slot('side', ...BERRY.slice(3), ...BERRY.slice(0, 3)),
    ],
  },

  // Cơm nhà kiểu Việt: bữa sáng là món nước/xôi/bánh mì, trưa & tối cơm – mặn – canh – rau
  vietnamese: {
    breakfast: [
      slot('base', D('pho-bo-tai'), D('xoi-do-xanh-hanh-phi'), D('bun-rieu-cua'), D('banh-mi-thit-nuong-rau-thom'), D('chao-ga-gung'), D('bun-bo-hue'), D('banh-cuon-cha-lua')),
      slot('side', ...FRUIT.slice(5), ...FRUIT.slice(0, 5)),
    ],
    lunch: [
      slot('base', F('gao-te', 70, 'Cơm trắng', 'gạo khô'), F('gao-te', 70, 'Cơm trắng', 'gạo khô'), F('gao-lut', 70, 'Cơm gạo lứt', 'gạo khô'), F('gao-te', 70, 'Cơm trắng', 'gạo khô'), F('gao-te', 70, 'Cơm trắng', 'gạo khô'), F('gao-lut', 70, 'Cơm gạo lứt', 'gạo khô'), F('gao-te', 70, 'Cơm trắng', 'gạo khô')),
      slot('main', F('thit-lon-nac', 100, 'Thịt nạc rim'), F('ca-thu', 120, 'Cá thu sốt cà'), F('thit-ga', 120, 'Gà luộc lá chanh'), F('thit-bo-nac', 100, 'Bò xào cần tỏi'), F('tom-dong', 120, 'Tôm rang thịt'), F('suon-lon', 120, 'Sườn rim chua ngọt'), F('ca-chep', 150, 'Cá chép kho riềng')),
      slot('side', ...CANH),
      slot('side', ...GREEN.slice(2), ...GREEN.slice(0, 2)),
    ],
    dinner: [
      slot('base', F('gao-te', 60, 'Cơm trắng', 'gạo khô'), F('gao-te', 60, 'Cơm trắng', 'gạo khô'), D('canh-chua-ca-va-nua-chen-com'), F('gao-te', 60, 'Cơm trắng', 'gạo khô'), D('canh-rau-ngot-thit-bam-va-nua-chen-com'), F('gao-lut', 60, 'Cơm gạo lứt', 'gạo khô'), F('gao-te', 60, 'Cơm trắng', 'gạo khô')),
      slot('main', F('ca-ro-phi', 150, 'Cá rô phi rán ít dầu'), F('trung-ga', 100, 'Trứng đúc thịt', '2 quả', 50), F('dau-phu', 150, 'Đậu phụ sốt cà'), F('thit-ga-dui', 120, 'Gà kho gừng'), F('ca-basa-phi-le', 150, 'Cá basa kho tộ'), F('thit-lon-nac', 100, 'Thịt luộc'), F('muc-tuoi', 150, 'Mực xào dứa')),
      slot('side', ...CANH.slice(3), ...CANH.slice(0, 3)),
      slot('side', ...FRUIT),
    ],
    snack: [
      slot('main', F('sua-chua-co-duong', 100, 'Sữa chua'), F('sua-dau-nanh-100g-lit', 250, 'Sữa đậu nành', null, 10), F('sua-hat-nutriva', 200, 'Sữa hạt NUTRIVA', null, 10), F('sua-bo-it-beo', 200, 'Sữa bò ít béo', null, 10), F('sua-chua-co-duong', 100, 'Sữa chua'), D('khoai-lang-luoc'), F('lac-dau-phong-rang', 15, 'Lạc rang')),
      slot('side', ...BERRY.slice(4), ...BERRY.slice(0, 4)),
    ],
  },
};

// Danh mục kế hoạch mẫu (ảnh bìa: /img/plans/<image>.webp)
export const PLAN_CATALOG = [
  {
    slug: 'eat-clean-van-phong-1200',
    title: 'Eat clean cho dân văn phòng bận rộn',
    summary: 'Bữa ăn gọn, dễ chuẩn bị trong 15 phút — đủ no, ít dầu mỡ, hỗ trợ giảm cân nhẹ nhàng.',
    description: 'Thực đơn dành cho người ngồi văn phòng nhiều giờ, ít thời gian nấu nướng. Mỗi ngày gồm 4 bữa với tinh bột nguyên hạt (gạo lứt, yến mạch, khoai lang), đạm nạc (ức gà, cá, tôm, đậu phụ) và ít nhất 300 g rau xanh. Các món chủ yếu luộc, hấp, áp chảo để giảm dầu mỡ. Mức 1.200–1.400 kcal phù hợp với phụ nữ ít vận động muốn giảm 0,25–0,5 kg mỗi tuần — nếu bạn tập luyện nhiều hơn, hãy chọn mức calo cao hơn.',
    style: 'eat-clean', pattern: 'eat-clean', kcalMin: 1200, kcalMax: 1400, offset: 0, image: 'mealprep',
  },
  {
    slug: 'eat-clean-van-phong-1400',
    title: 'Eat clean cho dân văn phòng bận rộn',
    summary: 'Phiên bản 1.400–1.600 kcal: thêm tinh bột tốt cho người đi bộ, đạp xe hằng ngày.',
    description: 'Giữ nguyên tinh thần eat clean — nguyên hạt, đạm nạc, nhiều rau — nhưng tăng khẩu phần tinh bột và đạm cho người có vận động nhẹ (đi bộ, đạp xe đi làm). Thực đơn xoay vòng 7 ngày để không bị ngán, mọi món đều có thể nấu trước cho 2–3 ngày.',
    style: 'eat-clean', pattern: 'eat-clean', kcalMin: 1400, kcalMax: 1600, offset: 2, image: 'salad',
  },
  {
    slug: 'thuan-chay-thanh-loc-1400',
    title: 'Thuần chay nhẹ nhàng: thanh lọc & đủ đạm thực vật',
    summary: 'Đạm từ đậu phụ, đậu đỗ, các loại hạt; nhiều nấm và rau lá — không thịt, cá, trứng, sữa động vật.',
    description: 'Thực đơn thuần chay cân đối cho người muốn ăn nhẹ hoặc ăn chay theo tôn giáo. Đạm được phối hợp từ đậu nành, đậu phụ, đỗ đen, đậu trắng và các loại hạt để đủ axit amin thiết yếu. Mỗi ngày có sữa đậu nành hoặc sữa hạt bổ sung canxi. Người ăn chay lâu dài nên bổ sung vitamin B12 theo tư vấn của bác sĩ.',
    style: 'plant', pattern: 'plant', kcalMin: 1400, kcalMax: 1600, offset: 0, image: 'tofu',
  },
  {
    slug: 'eat-clean-van-phong-1600',
    title: 'Eat clean cho dân văn phòng bận rộn',
    summary: 'Mức 1.600–1.800 kcal cho nam giới ít vận động hoặc nữ giới tập luyện đều đặn.',
    description: 'Phù hợp để duy trì cân nặng với người có mức vận động vừa phải. Bữa trưa là bữa chính với cơm gạo lứt, đạm nạc và hai loại rau; bữa tối nhẹ hơn để dễ ngủ. Bữa phụ gồm sữa chua hoặc hạt kèm trái cây giúp hạn chế ăn vặt đồ ngọt.',
    style: 'eat-clean', pattern: 'eat-clean', kcalMin: 1600, kcalMax: 1800, offset: 4, image: 'flatlay',
  },
  {
    slug: 'voc-dang-chong-oxy-hoa-1600',
    title: 'Cải thiện vóc dáng & tăng cường chống oxy hóa',
    summary: 'Rau củ, trái cây nhiều màu, hạt và cá béo — giàu vitamin C, E, polyphenol và omega-3.',
    description: 'Mỗi ngày có ít nhất 5 màu rau quả khác nhau (đỏ, cam, tím, xanh, vàng) cùng các loại hạt và cá béo như cá hồi, cá thu. Các chất chống oxy hóa và omega-3 hỗ trợ làn da, giảm viêm và phục hồi sau tập luyện. Lượng calo 1.600–1.800 kcal giúp săn chắc mà không bị đói.',
    style: 'balanced', pattern: 'balanced', kcalMin: 1600, kcalMax: 1800, offset: 0, image: 'fruitveg',
  },
  {
    slug: 'eat-clean-van-phong-1800',
    title: 'Eat clean cho dân văn phòng bận rộn',
    summary: 'Mức 1.800–2.000 kcal: đủ năng lượng cho ngày làm việc dài và buổi tập buổi tối.',
    description: 'Dành cho người làm việc nhiều giờ và tập thể thao 3–4 buổi mỗi tuần. Tinh bột nguyên hạt được chia đều cho 3 bữa chính để giữ năng lượng ổn định, đạm nạc ở mọi bữa giúp duy trì khối cơ.',
    style: 'eat-clean', pattern: 'eat-clean', kcalMin: 1800, kcalMax: 2000, offset: 1, image: 'chicken',
  },
  {
    slug: 'com-nha-can-bang-1800',
    title: 'Cơm nhà cân bằng kiểu Việt',
    summary: 'Cơm – mặn – canh – rau quen thuộc, nấu một lần cho cả nhà, đủ nhóm chất.',
    description: 'Giữ thói quen ăn uống của gia đình Việt: bữa sáng là phở, xôi, bánh mì, cháo; bữa trưa và tối có cơm, một món mặn, một bát canh và đĩa rau. Khẩu phần được cân để vừa 1.800–2.000 kcal, ưu tiên thịt nạc, cá và hạn chế chiên rán.',
    style: 'vietnamese', pattern: 'vietnamese', kcalMin: 1800, kcalMax: 2000, offset: 0, image: 'vietnam',
  },
  {
    slug: 'me-sau-sinh-2000',
    title: 'Mẹ sau sinh: giảm cân nhẹ nhàng, không lo thiếu sữa',
    summary: 'Đủ năng lượng & đạm cho mẹ cho con bú, nhiều canh rau và sữa để bổ sung nước, canxi.',
    description: 'Mẹ cho con bú cần thêm khoảng 500 kcal mỗi ngày so với bình thường, vì vậy thực đơn giữ ở mức 2.000–2.200 kcal để giảm cân chậm (khoảng 0,5 kg/tuần) mà vẫn đủ sữa. Mỗi bữa chính có canh rau, mỗi ngày có sữa hoặc sữa chua. Hạn chế đồ sống, rượu bia và cà phê đậm.',
    style: 'balanced', pattern: 'vietnamese', kcalMin: 2000, kcalMax: 2200, offset: 3, image: 'soup',
  },
  {
    slug: 'tang-dam-ban-ron-2000',
    title: 'Eat clean tăng đạm cho người bận rộn',
    summary: 'Đạm nạc ở mọi bữa, tinh bột vừa phải — no lâu, giữ cơ khi đang siết cân.',
    description: 'Khoảng 25–30% năng lượng đến từ đạm (ức gà, bò nạc, cá, trứng, sữa chua), tinh bột phức hợp ở mức vừa phải. Phù hợp cho người tập tạ 3–5 buổi mỗi tuần muốn giảm mỡ mà vẫn giữ cơ.',
    style: 'high-protein', pattern: 'high-protein', kcalMin: 2000, kcalMax: 2200, offset: 0, image: 'salmon',
  },
  {
    slug: 'tang-can-lanh-manh-2200',
    title: 'Tăng cân lành mạnh: cân bằng dinh dưỡng, tăng cơ tối ưu',
    summary: 'Tăng năng lượng từ tinh bột tốt, hạt và đạm chất lượng — không dựa vào đồ ngọt, chiên rán.',
    description: 'Dành cho người gầy muốn tăng 0,25–0,5 kg mỗi tuần. Năng lượng tăng từ cơm gạo lứt, khoai, các loại hạt và bơ; đạm từ thịt nạc, cá, trứng và sữa. Kết hợp tập kháng lực 3 buổi mỗi tuần để phần cân tăng thêm chủ yếu là cơ.',
    style: 'balanced', pattern: 'balanced', kcalMin: 2200, kcalMax: 2400, offset: 2, image: 'buddha',
  },
  {
    slug: 'chuan-gym-2400',
    title: 'Meal plan chuẩn gym: tăng cơ, giảm mỡ, sống khỏe',
    summary: 'Nhiều đạm, tinh bột đặt quanh giờ tập — cho người tập nặng 4–6 buổi mỗi tuần.',
    description: 'Thực đơn được thiết kế cho người tập luyện cường độ cao: khoảng 2 g đạm/kg cân nặng mỗi ngày, tinh bột tập trung vào bữa sáng và bữa trưa (trước – sau tập), chất béo tốt từ cá, trứng và các loại hạt. Uống đủ 2,5–3 lít nước mỗi ngày.',
    style: 'high-protein', pattern: 'high-protein', kcalMin: 2400, kcalMax: 2600, offset: 3, image: 'gym',
  },
  {
    slug: 'tang-can-lanh-manh-2400',
    title: 'Tăng cân lành mạnh: cân bằng dinh dưỡng, tăng cơ tối ưu',
    summary: 'Phiên bản 2.400–2.600 kcal cho nam giới gầy hoặc người lao động thể lực.',
    description: 'Mức năng lượng cao với bữa phụ giàu đạm và chất béo tốt (sữa, sữa chua, hạt). Chia nhỏ khẩu phần nếu bạn khó ăn nhiều trong một bữa.',
    style: 'balanced', pattern: 'balanced', kcalMin: 2400, kcalMax: 2600, offset: 5, image: 'nuts',
  },
];

const BOOSTERS = [
  { food: 'chuoi-tieu', label: 'Chuối tiêu', step: 10, max: 200 },
  { food: 'hat-dieu', label: 'Hạt điều', step: 5, max: 40 },
  { food: 'banh-mi-nguyen-cam', label: 'Bánh mì nguyên cám', step: 10, max: 100 },
  { food: 'qua-bo', label: 'Bơ chín', step: 10, max: 150 },
  { food: 'hanh-nhan', label: 'Hạnh nhân', step: 5, max: 40 },
  { food: 'khoai-lang', label: 'Khoai lang luộc', step: 10, max: 250 },
  { food: 'oc-cho', label: 'Óc chó', step: 5, max: 30 },
];

const round = (v, step) => Math.max(step, Math.round(v / step) * step);
const r1 = (v) => Math.round(v * 10) / 10;

// Sinh 7 ngày cho một kế hoạch; foods/dishes: danh sách (lean) để tính kcal khi cân định lượng
export function buildPlanDays(def, foods, dishes) {
  const pattern = PATTERNS[def.pattern];
  const food = new Map(foods.map((f) => [f.key, f]));
  const dish = new Map(dishes.map((d) => [d.key, d]));
  const kcalOf = (o) => (o.dish ? dish.get(o.dish).kcal * o.portion : (food.get(o.food).kcal * o.grams) / 100);
  for (const meal of Object.values(pattern))
    for (const s of meal)
      for (const o of s.options) {
        if (o.dish && !dish.has(o.dish)) throw new Error(`Kế hoạch ${def.slug}: thiếu món ${o.dish}`);
        if (o.food && !food.has(o.food)) throw new Error(`Kế hoạch ${def.slug}: thiếu thực phẩm ${o.food}`);
      }

  const dayTarget = (def.kcalMin + def.kcalMax) / 2;
  return Array.from({ length: 7 }, (_, day) => {
    const items = [];
    for (const [meal, slots] of Object.entries(pattern)) {
      const picked = slots.map((s) => ({ role: s.role, o: { ...s.options[(day + def.offset) % s.options.length] } }));
      const target = dayTarget * MEAL_SHARE[meal];
      const fixed = picked.filter((p) => p.role === 'side').reduce((s, p) => s + kcalOf(p.o), 0);
      const sum = (role) => picked.filter((p) => p.role === role).reduce((s, p) => s + kcalOf(p.o), 0);
      const scale = (role, k) => {
        for (const { o } of picked.filter((p) => p.role === role)) {
          if (o.dish) o.portion = Math.min(2, Math.max(0.5, Math.round(o.portion * k * 4) / 4));
          else o.grams = Math.min(/khô/.test(o.note ?? '') ? 100 : o.step === 10 ? 300 : 280, round(o.grams * k, o.step));
        }
      };
      // Đạm co giãn một nửa (tránh khẩu phần thịt quá lớn), tinh bột bù phần năng lượng còn lại
      const k = (target - fixed) / (sum('main') + sum('base'));
      scale('main', Math.min(1.8, Math.max(0.6, 1 + (k - 1) * (sum('base') ? 0.5 : 1))));
      if (sum('base')) scale('base', Math.min(3, Math.max(0.5, (target - fixed - sum('main')) / sum('base'))));
      for (const { o } of picked) {
        // Ghi chú "2 quả" chỉ đúng khi số gram không đổi
        const note = o.note && /quả/.test(o.note) ? `${o.grams / 50} quả` : o.note;
        items.push(o.dish ? { meal, dish: o.dish, portion: r1(o.portion) } : { meal, food: o.food, grams: o.grams, label: o.label, ...(note ? { note } : {}) });
      }
    }
    // Bù năng lượng còn thiếu (do trần định lượng) bằng món phụ ở bữa nhẹ — đều là thực phẩm thực vật
    let total = items.reduce((t, it) => t + kcalOf(it), 0);
    for (let i = 0; total < def.kcalMin + 60 && i < 3; i++) {
      const b = BOOSTERS[(day + def.offset + i) % BOOSTERS.length];
      const f = food.get(b.food);
      const grams = Math.min(b.max, round(((dayTarget - total) * 100) / f.kcal, b.step));
      items.push({ meal: 'snack', food: b.food, grams, label: b.label });
      total += (f.kcal * grams) / 100;
    }
    return { items };
  });
}

export function buildMealPlans(foods, dishes) {
  return PLAN_CATALOG.map((def, i) => ({
    slug: def.slug,
    title: def.title,
    summary: def.summary,
    description: def.description,
    style: def.style,
    kcalMin: def.kcalMin,
    kcalMax: def.kcalMax,
    image: `/img/plans/${def.image}.webp`,
    imageCredit: IMAGE_CREDITS[def.image],
    sort: i,
    days: buildPlanDays(def, foods, dishes),
    active: true,
  }));
}
