# WorkShift Tracker Step-by-Step Roadmap

Mục tiêu: triển khai app desktop chấm công cá nhân bằng Electron + React + TypeScript theo từng bước nhỏ, mỗi bước đều chạy thử được.

## Phase 0: Chuẩn bị môi trường

1. Kiểm tra Node.js và npm:

```powershell
node -v
npm.cmd -v
```

2. Nếu chưa có Node.js, cài bản LTS trước rồi chạy lại lệnh kiểm tra.

3. Làm việc trong thư mục:

```powershell
cd D:\workshift-tracker
```

4. Vì thư mục hiện chưa có git, nếu muốn quản lý lịch sử code thì khởi tạo:

```powershell
git init
```

## Phase 1: Setup project Electron + React + TypeScript

1. Tạo `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`.

2. Cài dependencies chính:

```powershell
npm.cmd install electron vite @vitejs/plugin-react typescript react react-dom
npm.cmd install date-fns lucide-react
npm.cmd install -D concurrently wait-on cross-env vitest @types/node @types/react @types/react-dom
```

3. Tạo các script:

```json
{
  "dev": "vite --host 127.0.0.1",
  "electron:dev": "concurrently \"npm.cmd run dev\" \"wait-on http://127.0.0.1:5173 && cross-env VITE_DEV_SERVER_URL=http://127.0.0.1:5173 electron .\"",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "build": "tsc && vite build"
}
```

4. Tạo app rỗng:

- `electron/main.ts`: mở cửa sổ Electron.
- `electron/preload.ts`: chuẩn bị bridge an toàn.
- `src/main.tsx`: render React.
- `src/App.tsx`: hiển thị dashboard placeholder.

5. Chạy thử:

```powershell
npm.cmd run electron:dev
```

Kết quả mong muốn: mở được cửa sổ desktop có giao diện React rỗng.

## Phase 2: Xây lõi tính giờ

1. Tạo type dữ liệu:

- `WorkdayRecord`
- `WorkshiftSettings`
- `WorkshiftState`
- `ShiftStatus`

2. Tạo helper tính giờ:

- `elapsedMinutes(record, now)`
- `shiftStatus(record, now)`
- `progressRatio(record, now)`
- `formatDuration(minutes)`

3. Viết test bằng Vitest cho các trường hợp:

- Chưa check-in.
- Đang làm.
- Đã check-out.
- Đủ giờ mục tiêu.

4. Chạy test:

```powershell
npm.cmd test
```

Kết quả mong muốn: logic tính giờ đúng trước khi nối UI.

## Phase 3: Lưu dữ liệu local

1. Tạo storage JSON trong Electron:

```text
<userData>/workshift-state.json
```

2. Dữ liệu mặc định:

- target: `480` phút.
- bật start at login.
- bật widget.
- bật notification.

3. Thêm IPC từ Electron main:

- `getState`
- `checkIn`
- `checkOut`
- `updateRecord`
- `updateSettings`

4. Expose API sang React qua preload:

```ts
window.workshift.getState()
window.workshift.checkIn()
window.workshift.checkOut()
```

5. Chạy thử:

```powershell
npm.cmd run electron:dev
```

Kết quả mong muốn: check-in xong, tắt app mở lại vẫn còn dữ liệu.

## Phase 4: Màn hình hôm nay

1. Tạo `TodayPanel`.

2. Hiển thị:

- Trạng thái ca.
- Giờ vào.
- Giờ ra.
- Tổng giờ đã làm.
- Thanh tiến trình.
- Nút `Vào ca`.
- Nút `Kết thúc ca`.

3. Thêm timer cập nhật mỗi 30 giây khi đang làm.

4. Thêm popup đầu ngày:

- `Bắt đầu ca làm?`
- `Vào ca`
- `Bỏ qua`

5. Chạy thử luồng:

- Mở app.
- Bấm `Vào ca`.
- Đợi timer chạy.
- Bấm `Kết thúc ca`.

Kết quả mong muốn: UI phản ánh đúng ca làm hôm nay.

## Phase 5: Thông báo đủ giờ

1. Thêm setting `notifyOnComplete`.

2. Trong Electron main, dùng `Notification` để hiện popup:

```text
Hoàn thành ca hôm nay!
```

3. Trong React, khi elapsed >= target và chưa notify trong ngày, gọi IPC notification.

4. Test nhanh bằng cách đổi target xuống `1` phút.

Kết quả mong muốn: đủ giờ thì app báo popup và không spam nhiều lần.

## Phase 6: Lịch sử ngày/tháng

1. Tạo `HistoryTable`.

2. Thêm filter:

- Theo tháng.
- Theo tuần trong tháng.

3. Bảng gồm:

- Ngày.
- Giờ vào.
- Giờ ra.
- Tổng giờ.
- Ghi chú.
- Nghỉ.
- OT.

4. Cho phép sửa:

- Note.
- Đánh dấu ngày nghỉ.
- Đánh dấu OT.

5. Highlight đỏ nếu thiếu giờ và không phải ngày nghỉ.

Kết quả mong muốn: quản lý được log theo ngày và lọc theo tháng/tuần.

## Phase 7: Thống kê tháng

1. Tạo helper thống kê:

- Tổng giờ tháng.
- Số ngày đi làm.
- Số ngày nghỉ.
- Số ngày thiếu giờ.
- Tổng giờ theo tuần.

2. Tạo `MonthlyStats`.

3. Hiển thị:

- Card tổng giờ.
- Card ngày đi làm.
- Card ngày nghỉ.
- Card ngày thiếu giờ.
- Biểu đồ cột đơn giản theo tuần.

4. Viết test cho helper thống kê.

Kết quả mong muốn: nhìn nhanh được hiệu suất tháng.

## Phase 8: Export CSV

1. Thêm nút `Export CSV`.

2. Electron mở save dialog.

3. Ghi file CSV với cột:

```text
Date,Check In,Check Out,Total Hours,Target Hours,Day Off,Overtime,Note
```

4. Chạy thử:

- Tạo vài record.
- Export.
- Mở CSV bằng Excel hoặc editor.

Kết quả mong muốn: file export khớp dữ liệu trên UI.

## Phase 9: System Tray

1. Tạo tray icon.

2. Menu chuột phải:

- Mở app.
- Vào ca.
- Kết thúc ca.
- Hiện/ẩn widget.
- Thoát.

3. Khi đóng cửa sổ chính, app ẩn xuống tray thay vì thoát.

4. Icon đổi theo trạng thái:

- Chưa vào ca.
- Đang làm.
- Đủ giờ.

Kết quả mong muốn: app chạy nền đúng kiểu desktop utility.

## Phase 10: Auto-start Windows

1. Thêm setting `startAtLogin`.

2. Khi setting bật, gọi:

```ts
app.setLoginItemSettings({ openAtLogin: true });
```

3. Khi setting tắt, gọi:

```ts
app.setLoginItemSettings({ openAtLogin: false });
```

4. Test bằng cách restart hoặc kiểm tra Startup Apps trong Windows Settings.

Kết quả mong muốn: app tự chạy cùng Windows nếu user bật setting.

## Phase 11: Mini widget

1. Tạo cửa sổ widget riêng:

- Frameless.
- Always on top.
- Kích thước nhỏ.
- Góc màn hình.

2. Widget hiển thị:

- Thời gian đang làm.
- Progress nhỏ.
- Màu trạng thái.
- Nút ẩn.

3. Cho phép bật/tắt widget từ:

- Settings.
- Tray menu.

Kết quả mong muốn: xem nhanh giờ làm mà không cần mở app chính.

## Phase 12: Polish UI

1. Bố cục app:

- Header nhỏ.
- Cột trái: hôm nay.
- Cột phải: thống kê tháng.
- Dưới: lịch sử.

2. Style theo hướng desktop productivity:

- Gọn.
- Dễ đọc.
- Không màu mè.
- Nút/action rõ ràng.

3. Kiểm tra responsive cho cửa sổ nhỏ.

Kết quả mong muốn: app dùng hằng ngày không rối mắt.

## Phase 13: Build và kiểm tra cuối

1. Typecheck:

```powershell
npm.cmd run typecheck
```

2. Test:

```powershell
npm.cmd test
```

3. Build:

```powershell
npm.cmd run build
```

4. Chạy dev app:

```powershell
npm.cmd run electron:dev
```

5. Kiểm tra tay toàn bộ luồng:

- Mở app.
- Popup đầu ngày.
- Check-in.
- Timer chạy.
- Đủ giờ có notification.
- Check-out.
- Lịch sử cập nhật.
- Thống kê cập nhật.
- Export CSV.
- Tray hoạt động.
- Widget hiện/ẩn.

## Thứ tự triển khai khuyến nghị

1. Setup app chạy được.
2. Tính giờ đúng bằng test.
3. Lưu dữ liệu local.
4. Dashboard hôm nay.
5. Lịch sử.
6. Thống kê.
7. Export.
8. Tray.
9. Auto-start.
10. Widget.
11. Polish và build.

Không nên làm tray/widget trước khi dashboard và storage ổn, vì desktop integration khó debug hơn logic core.
