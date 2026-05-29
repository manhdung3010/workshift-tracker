# WorkShift Tracker MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Windows desktop time-tracking app with Electron + React + TypeScript for daily check-in/check-out, live progress, local logs, monthly stats, tray controls, mini widget, and CSV export.

**Architecture:** Use Electron for desktop integration and local persistence, React for the dashboard UI, and a small domain layer for shift/session calculations. Store data in a JSON file under Electron `app.getPath("userData")` so the MVP works offline without a database.

**Tech Stack:** Electron, Vite, React, TypeScript, Vitest, electron-store or JSON file storage, lucide-react, date-fns, CSS modules or plain CSS.

---

## MVP Scope

Build the dashboard-first version:

- Main window opens to today's shift status.
- Startup popup asks "Bắt đầu ca làm?" with `Vào ca` and `Bỏ qua`.
- Check-in, live timer, progress toward configurable target hours, check-out.
- Completion notification when the target is reached.
- Local history table with month/week filters, note, day off, and OT markers.
- Monthly summary and simple weekly bar chart.
- CSV export.
- System tray menu with quick actions.
- Mini floating widget that can be shown/hidden.

Defer these until after MVP unless time remains:

- Signed installer.
- Excel `.xlsx` export.
- Multi-device sync.
- Advanced break tracking.
- Manual time correction approval workflow.

## Proposed File Structure

- `package.json`: scripts and dependencies.
- `vite.config.ts`: renderer build config.
- `tsconfig.json`, `tsconfig.node.json`: TypeScript config.
- `electron/main.ts`: app lifecycle, windows, tray, auto-start, notifications, IPC handlers.
- `electron/preload.ts`: safe IPC API exposed to React.
- `electron/storage/shiftStore.ts`: JSON persistence for settings and daily records.
- `electron/windows.ts`: main window and widget window creation.
- `src/main.tsx`: React entrypoint.
- `src/App.tsx`: top-level dashboard shell.
- `src/domain/time.ts`: pure time calculation helpers.
- `src/domain/records.ts`: pure record/stat helpers.
- `src/types/workshift.ts`: shared TypeScript types.
- `src/lib/electronApi.ts`: renderer-side API wrapper.
- `src/components/TodayPanel.tsx`: check-in/check-out and progress.
- `src/components/HistoryTable.tsx`: daily log table and filters.
- `src/components/MonthlyStats.tsx`: summary and weekly chart.
- `src/components/SettingsPanel.tsx`: target hours, startup toggle, widget toggle.
- `src/components/StartupPrompt.tsx`: confirmation dialog UI.
- `src/widget/Widget.tsx`: mini timer UI.
- `src/styles.css`: desktop app styling.
- `src/domain/*.test.ts`: unit tests for calculations.

## Data Model

```ts
export type ShiftStatus = "not_started" | "working" | "completed" | "checked_out";

export type WorkdayRecord = {
  date: string; // yyyy-MM-dd
  checkInAt?: string; // ISO timestamp
  checkOutAt?: string; // ISO timestamp
  targetMinutes: number;
  note: string;
  isDayOff: boolean;
  isOvertime: boolean;
};

export type WorkshiftSettings = {
  targetMinutes: number;
  startAtLogin: boolean;
  showWidget: boolean;
  notifyOnComplete: boolean;
};

export type WorkshiftState = {
  settings: WorkshiftSettings;
  records: WorkdayRecord[];
};
```

## Task 1: Scaffold Electron + React + TypeScript

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Create project metadata and scripts**

Use these scripts:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "electron:dev": "concurrently \"npm.cmd run dev\" \"wait-on http://127.0.0.1:5173 && cross-env VITE_DEV_SERVER_URL=http://127.0.0.1:5173 electron .\"",
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.node.json && vite build",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit"
  },
  "main": "dist-electron/main.js"
}
```

- [ ] **Step 2: Install dependencies**

Run:

```powershell
npm.cmd install
npm.cmd install electron @vitejs/plugin-react vite typescript react react-dom date-fns lucide-react
npm.cmd install -D concurrently wait-on cross-env vitest @types/node @types/react @types/react-dom
```

Expected: `node_modules` and `package-lock.json` are created.

- [ ] **Step 3: Create a minimal Electron shell**

Implement `electron/main.ts` with a `BrowserWindow`, preload script, and dev/prod URL handling.

- [ ] **Step 4: Create a minimal React app**

Implement `src/App.tsx` with a placeholder dashboard shell and load it from `src/main.tsx`.

- [ ] **Step 5: Verify scaffold**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run electron:dev
```

Expected: typecheck passes and a desktop window opens.

## Task 2: Add Domain Time Calculations

**Files:**
- Create: `src/types/workshift.ts`
- Create: `src/domain/time.ts`
- Create: `src/domain/time.test.ts`
- Create: `src/domain/records.ts`
- Create: `src/domain/records.test.ts`

- [ ] **Step 1: Write tests for elapsed minutes and status**

Cover:

- Not started record returns `0`.
- Working record calculates from `checkInAt` to current time.
- Checked-out record calculates from `checkInAt` to `checkOutAt`.
- Completed status starts when elapsed minutes >= target minutes.

- [ ] **Step 2: Implement pure helpers**

Functions:

```ts
elapsedMinutes(record: WorkdayRecord, now: Date): number
shiftStatus(record: WorkdayRecord | undefined, now: Date): ShiftStatus
progressRatio(record: WorkdayRecord | undefined, now: Date): number
formatDuration(minutes: number): string
```

- [ ] **Step 3: Verify domain layer**

Run:

```powershell
npm.cmd test
```

Expected: all domain tests pass.

## Task 3: Add Local Persistence and IPC

**Files:**
- Create: `electron/storage/shiftStore.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Create: `src/lib/electronApi.ts`

- [ ] **Step 1: Implement JSON storage**

Store file:

```text
<Electron userData>/workshift-state.json
```

Default settings:

```ts
{
  targetMinutes: 480,
  startAtLogin: true,
  showWidget: true,
  notifyOnComplete: true
}
```

- [ ] **Step 2: Add IPC methods**

Expose:

```ts
getState()
checkIn(nowIso)
checkOut(nowIso)
updateRecord(record)
updateSettings(settingsPatch)
exportCsv(month)
showWidget()
hideWidget()
```

- [ ] **Step 3: Add preload bridge**

Expose a typed `window.workshift` API using `contextBridge`.

- [ ] **Step 4: Verify persistence manually**

Run the app, check in, close it, reopen it, and confirm today's record remains.

## Task 4: Build Dashboard UI

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/TodayPanel.tsx`
- Create: `src/components/StartupPrompt.tsx`
- Create: `src/components/SettingsPanel.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Load state from Electron API**

On app start, call `window.workshift.getState()` and keep state in React.

- [ ] **Step 2: Implement startup prompt**

If today's record has no `checkInAt`, show modal:

- `Bắt đầu ca làm?`
- `Vào ca`: calls `checkIn(new Date().toISOString())`
- `Bỏ qua`: closes modal without writing a check-in

- [ ] **Step 3: Implement today panel**

Show:

- Current status.
- `HH:mm` check-in time.
- `HH:mm` check-out time if present.
- `6h30 / 8h` style progress.
- Progress bar.
- `Vào ca` and `Kết thúc ca` buttons.

- [ ] **Step 4: Add real-time ticking**

Use a `setInterval` every 30 seconds while status is `working`.

- [ ] **Step 5: Verify UI flow**

Run:

```powershell
npm.cmd run electron:dev
```

Expected: check-in updates the timer, check-out freezes elapsed time.

## Task 5: Add Completion Notification

**Files:**
- Modify: `electron/main.ts`
- Modify: `src/App.tsx`
- Modify: `src/lib/electronApi.ts`

- [ ] **Step 1: Add IPC method for notification**

Implement `notifyShiftComplete()` in main process with Electron `Notification`.

- [ ] **Step 2: Trigger once per day**

In React, when status changes from `working` to `completed`, call `notifyShiftComplete()`.

- [ ] **Step 3: Verify notification**

Temporarily set target to `1` minute, check in, wait until completion, confirm notification appears.

## Task 6: Add History, Filters, and Notes

**Files:**
- Create: `src/components/HistoryTable.tsx`
- Modify: `src/App.tsx`
- Modify: `electron/storage/shiftStore.ts`

- [ ] **Step 1: Add month/week filters**

Default to current month. Add a week filter derived from the selected month.

- [ ] **Step 2: Render log table**

Columns:

- Ngày
- Giờ vào
- Giờ ra
- Tổng giờ
- Trạng thái
- Ghi chú

- [ ] **Step 3: Add editable markers**

Allow toggling:

- `Nghỉ`
- `OT`

Allow editing note text and save through `updateRecord(record)`.

- [ ] **Step 4: Highlight missing days**

If a workday has elapsed minutes below target and is not day off, render it red.

## Task 7: Add Monthly Stats and Weekly Chart

**Files:**
- Create: `src/components/MonthlyStats.tsx`
- Modify: `src/domain/records.ts`
- Modify: `src/domain/records.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add stat helpers**

Functions:

```ts
monthlyTotalMinutes(records, month): number
workedDays(records, month): number
dayOffCount(records, month): number
missingDays(records, month, now): WorkdayRecord[]
weeklyTotals(records, month): { weekLabel: string; minutes: number }[]
```

- [ ] **Step 2: Test stats**

Use fixture records covering normal day, day off, short day, and OT day.

- [ ] **Step 3: Render stats**

Show:

- Tổng giờ tháng
- Số ngày đi làm
- Số ngày nghỉ
- Số ngày thiếu giờ
- Weekly bar chart

## Task 8: Add CSV Export

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/storage/shiftStore.ts`
- Modify: `src/components/HistoryTable.tsx`

- [ ] **Step 1: Implement CSV generation**

Fields:

```text
Date,Check In,Check Out,Total Hours,Target Hours,Day Off,Overtime,Note
```

- [ ] **Step 2: Save with Electron dialog**

Use `dialog.showSaveDialog` and write UTF-8 CSV.

- [ ] **Step 3: Verify export**

Create two records, export current month, open CSV and confirm rows match UI.

## Task 9: Add System Tray and Auto-Start

**Files:**
- Modify: `electron/main.ts`
- Create: `electron/tray.ts`
- Add: `assets/tray-idle.png`
- Add: `assets/tray-working.png`
- Add: `assets/tray-complete.png`

- [ ] **Step 1: Create tray menu**

Menu items:

- `Mở WorkShift Tracker`
- `Vào ca`
- `Kết thúc ca`
- `Hiện/ẩn widget`
- `Thoát`

- [ ] **Step 2: Change tray icon by status**

Use:

- idle: not started
- working: checked in but not complete
- complete: target reached

- [ ] **Step 3: Enable Windows startup**

Call:

```ts
app.setLoginItemSettings({ openAtLogin: settings.startAtLogin });
```

- [ ] **Step 4: Verify minimize behavior**

Close main window should hide to tray. `Thoát` should quit the app.

## Task 10: Add Mini Widget

**Files:**
- Create: `electron/windows.ts`
- Create: `src/widget/Widget.tsx`
- Modify: `src/main.tsx`
- Modify: `electron/main.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Create frameless widget window**

Widget settings:

- `frame: false`
- `alwaysOnTop: true`
- fixed compact size
- bottom-right default position

- [ ] **Step 2: Render compact timer**

Show:

- `06:30`
- small progress ring/bar
- status color
- hide button

- [ ] **Step 3: Wire tray toggle**

Tray menu toggles widget visibility through `showWidget()` and `hideWidget()`.

## Task 11: Polish and Verification

**Files:**
- Modify: `README.md`
- Modify: `src/styles.css`
- Modify: related touched files only

- [ ] **Step 1: Add README usage**

Document:

- install
- run dev app
- run tests
- data storage path
- export behavior

- [ ] **Step 2: Full verification**

Run:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run electron:dev
```

Expected:

- Typecheck passes.
- Tests pass.
- Build succeeds.
- App opens and supports check-in/check-out, stats, export, tray, and widget.

## Implementation Order

1. Scaffold and open desktop shell.
2. Domain tests and time calculations.
3. Persistence + IPC.
4. Today dashboard.
5. History and stats.
6. Export.
7. Tray and startup.
8. Mini widget.
9. Polish and verification.

This order keeps the app runnable after each milestone and avoids building desktop integrations before the core time-tracking model is proven.

## Plan Self-Review

- Scope is one MVP, not a multi-app platform.
- All requested core features map to at least one task.
- Excel export is intentionally deferred in favor of CSV for MVP speed.
- The plan avoids cloud/database complexity.
- No project commits are required because `D:\workshift-tracker` is currently not a git repository.
