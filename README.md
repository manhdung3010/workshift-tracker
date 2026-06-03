# WorkShift Tracker

Personal Windows work shift tracker built with Electron, React, TypeScript, and electron-vite.

## Features

- Start and end a daily work shift.
- Track elapsed time, remaining time, estimated shift end, and completion progress.
- Compact always-on-top widget with draggable position, resizable compact bounds, and remembered full/compact window positions.
- Monthly log screen backed by saved records.
- Editable settings for schedule, target hours, lunch window, reminders, startup behavior, and compact widget preference.
- Local-only state stored on the user's machine.

## Requirements

- Node.js 22 or newer is recommended.
- Windows PowerShell works best with `npm.cmd`.

Install dependencies:

```powershell
npm.cmd install
```

## Run In Development

Start the Electron app with hot reload:

```powershell
npm.cmd run dev
```

Equivalent script:

```powershell
npm.cmd run electron:dev
```

## Verification

Run unit tests:

```powershell
npm.cmd test
```

Run TypeScript checks:

```powershell
npm.cmd run typecheck
```

Run the production build:

```powershell
npm.cmd run build
```

The build writes Electron output to `out/`.

## Package For Windows

Build an NSIS installer:

```powershell
npm.cmd run dist
```

Build a Windows zip package:

```powershell
npm.cmd run dist:zip
```

Packaged artifacts are written to `dist/`.

## Preview Built App

After `npm.cmd run build`, preview the built Electron app:

```powershell
npm.cmd run preview
```

## Data Storage

In Electron mode, app state is stored under Electron's `userData` directory as:

```text
workshift-state.json
```

The state includes:

- `settings`: schedule, lunch time, notifications, startup, and widget settings.
- `records`: daily work logs.
- `windowBounds`: remembered full window and compact widget positions/sizes.

Default schedule:

- Work: `09:00 -> 18:00`
- Lunch: `12:00 -> 13:30`
- Target: `8h`
- Workdays: Monday to Friday

## Notes

- The compact widget is always-on-top while minimized.
- Drag the compact widget to reposition it.
- Resize the compact widget smaller if desired; when it becomes too small, only time left is shown.
- The full window and compact widget positions are remembered after restart.
