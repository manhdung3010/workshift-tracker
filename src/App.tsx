import {
  IconBell,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconHistory,
  IconHome,
  IconLogin2,
  IconMinus,
  IconPlayerPlay,
  IconSettings,
  IconSpeakerphone,
  IconTableExport,
  IconTimelineEvent,
  IconLogout2,
  IconX,
  IconWindowMinimize
} from "@tabler/icons-react";
import { format, isSameMonth } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { elapsedMinutes, formatDuration, progressRatio, shiftStatus } from "./domain/time";
import { workshiftApi } from "./lib/electronApi";
import type { WorkdayRecord, WorkshiftState } from "./types/workshift";

type Screen = "home" | "history" | "settings";

const sampleLogs = [
  {
    day: "04",
    weekday: "Mon",
    time: "09:00 -> 17:15",
    total: "8h15",
    badge: "Full",
    tone: "success"
  },
  { day: "05", weekday: "Tue", time: "09:20 -> 17:30", total: "8h10", badge: "Full", tone: "success" },
  {
    day: "06",
    weekday: "Wed",
    time: "10:00 -> 15:30",
    total: "5h30",
    badge: "Short",
    tone: "danger"
  },
  { day: "07", weekday: "Thu", time: "Day off", total: "-", badge: "Day off", tone: "muted" },
  {
    day: "08",
    weekday: "Fri",
    time: "08:50 -> 17:00",
    total: "8h10",
    badge: "Full",
    tone: "success"
  },
  { day: "11", weekday: "Mon", time: "09:10 -> 17:05", total: "7h55", badge: "Short", tone: "danger" },
  {
    day: "12",
    weekday: "Tue",
    time: "09:30 -> 16:00",
    total: "6h30",
    badge: "Short",
    tone: "danger"
  }
] as const;

function statusLabel(status: ReturnType<typeof shiftStatus>): string {
  if (status === "not_started") return "Idle";
  if (status === "working") return "Working";
  if (status === "completed") return "Completed";
  return "Checked out";
}

function todayKey(now: Date): string {
  return format(now, "yyyy-MM-dd");
}

function Toggle({ checked }: { checked: boolean }): React.JSX.Element {
  return <span className={`toggle ${checked ? "toggle-on" : ""}`} aria-hidden="true" />;
}

export function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>("home");
  const [state, setState] = useState<WorkshiftState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [showEarlyWarning, setShowEarlyWarning] = useState(false);

  useEffect(() => {
    void workshiftApi.getState().then(setState);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const todayRecord = useMemo<WorkdayRecord | undefined>(() => {
    return state?.records.find((record) => record.date === todayKey(now));
  }, [now, state]);

  const status = shiftStatus(todayRecord, now);
  const elapsed = todayRecord ? elapsedMinutes(todayRecord, now) : 0;
  const target = todayRecord?.targetMinutes ?? state?.settings.targetMinutes ?? 480;
  const progressPercent = Math.round(progressRatio(todayRecord, now) * 100);
  const remaining = Math.max(0, target - elapsed);
  const canCheckIn = status === "not_started";
  const canEndNormally = status === "completed";
  const isWorking = status === "working" || status === "completed";
  const checkInLabel = todayRecord?.checkInAt ? format(new Date(todayRecord.checkInAt), "HH:mm") : "--:--";
  const estimatedEnd = todayRecord?.checkInAt
    ? format(new Date(new Date(todayRecord.checkInAt).getTime() + target * 60_000), "HH:mm")
    : "--:--";
  const monthRecords = state?.records.filter((record) => isSameMonth(new Date(record.date), now)) ?? [];
  const monthlyMinutes = monthRecords.reduce(
    (total, record) => total + elapsedMinutes(record, now),
    0
  );

  function handleMinimize(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
    void workshiftApi.minimizeWindow();
  }

  function handleMinimizePointerDown(event: React.PointerEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
    void workshiftApi.minimizeWindow();
  }

  function handleClose(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
    void workshiftApi.closeWindow();
  }

  async function handleCheckIn(): Promise<void> {
    setShowEarlyWarning(false);
    setState(await workshiftApi.checkIn());
    setNow(new Date());
  }

  async function handleEndShift(): Promise<void> {
    if (!canEndNormally) {
      setShowEarlyWarning(true);
      return;
    }

    setState(await workshiftApi.checkOut());
    setNow(new Date());
  }

  async function handleEndEarly(): Promise<void> {
    setState(await workshiftApi.checkOut());
    setShowEarlyWarning(false);
    setNow(new Date());
  }

  return (
    <main className="app-frame">
      <section className="app-window">
        <div className="custom-titlebar">
          <div className="titlebar-brand">
            <span className="app-mark">W</span>
            <span>WorkShift Tracker</span>
          </div>
          <div className="window-controls">
            <button
              type="button"
              aria-label="Minimize window"
              onPointerDown={handleMinimizePointerDown}
              onClick={handleMinimize}
            >
              <IconMinus size={16} />
            </button>
            <button
              className="close-control"
              type="button"
              aria-label="Close window"
              onClick={handleClose}
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        <header className="window-titlebar">
          <div>
            <p className="window-kicker">WorkShift Tracker</p>
            <h1>
              {screen === "home" && "Home"}
              {screen === "history" && "History / Log"}
              {screen === "settings" && "Settings"}
            </h1>
          </div>
          {screen === "home" && (
            <span className={`status-pill status-${status}`}>
              <span />
              {statusLabel(status)}
            </span>
          )}
          {screen === "history" && (
            <button className="toolbar-button" type="button">
              <IconTableExport size={17} />
              Excel
            </button>
          )}
          {screen === "settings" && <IconSettings className="title-icon" size={22} />}
        </header>

        <nav className="screen-tabs" aria-label="Primary screens">
          <button
            className={screen === "home" ? "active-tab" : ""}
            type="button"
            onClick={() => setScreen("home")}
          >
            <IconHome size={17} />
            Home
          </button>
          <button
            className={screen === "history" ? "active-tab" : ""}
            type="button"
            onClick={() => setScreen("history")}
          >
            <IconHistory size={17} />
            Log
          </button>
          <button
            className={screen === "settings" ? "active-tab" : ""}
            type="button"
            onClick={() => setScreen("settings")}
          >
            <IconSettings size={17} />
            Settings
          </button>
        </nav>

        {screen === "home" && (
          <section className="screen-content">
            <div className="date-clock">
              <p>{format(now, "EEEE, dd MMMM yyyy")}</p>
              <strong>{format(now, "HH:mm:ss")}</strong>
            </div>

            <div className="tray-row" aria-label="System tray indicator colors">
              <span>
                <i className="tray-dot tray-red" /> Idle
              </span>
              <span>
                <i className="tray-dot tray-yellow" /> Working
              </span>
              <span>
                <i className="tray-dot tray-green" /> Done
              </span>
            </div>

            <button
              className={`start-circle ${isWorking ? "start-circle-active" : ""}`}
              type="button"
              disabled={!canCheckIn}
              onClick={() => void handleCheckIn()}
            >
              <IconPlayerPlay size={28} />
              <span>{isWorking ? "SHIFT ON" : "START SHIFT"}</span>
            </button>

            <div className="progress-block">
              <div className="progress-label">
                <span>
                  {formatDuration(elapsed)} / {formatDuration(target)}
                </span>
                <strong>{progressPercent}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="info-card-grid">
              <div className="info-card">
                <span>Check-in</span>
                <strong>{checkInLabel}</strong>
              </div>
              <div className="info-card">
                <span>Est. end</span>
                <strong>{estimatedEnd}</strong>
              </div>
              <div className="info-card">
                <span>Today total</span>
                <strong>{formatDuration(elapsed)}</strong>
              </div>
            </div>

            {todayRecord?.checkOutAt && (
              <div className="shift-log-card">
                <div className="shift-log-heading">
                  <span>
                    <IconTimelineEvent size={16} />
                    Today's shift log
                  </span>
                  <strong>{formatDuration(elapsed)}</strong>
                </div>
                <div className="shift-log-times">
                  <div>
                    <IconLogin2 size={15} />
                    <span>In</span>
                    <strong>{checkInLabel}</strong>
                  </div>
                  <i aria-hidden="true" />
                  <div>
                    <IconLogout2 size={15} />
                    <span>Out</span>
                    <strong>{format(new Date(todayRecord.checkOutAt), "HH:mm")}</strong>
                  </div>
                </div>
                <p>Today is completed. A new shift can start tomorrow.</p>
              </div>
            )}

            <button
              className="end-button"
              type="button"
              disabled={!isWorking}
              onClick={() => void handleEndShift()}
            >
              End shift
            </button>

            {showEarlyWarning && (
              <div className="warning-modal" role="dialog" aria-label="Early end warning">
                <strong>End shift early?</strong>
                <p>
                  {formatDuration(elapsed)} done / {formatDuration(target)} required.
                  {remaining > 0 ? ` ${formatDuration(remaining)} remaining.` : ""}
                </p>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowEarlyWarning(false)}>
                    Continue working
                  </button>
                  <button type="button" onClick={() => void handleEndEarly()}>
                    End early
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {screen === "history" && (
          <section className="screen-content">
            <div className="month-nav">
              <button type="button" aria-label="Previous month">
                <IconChevronLeft size={18} />
              </button>
              <strong>{format(now, "MMMM yyyy")}</strong>
              <button type="button" aria-label="Next month">
                <IconChevronRight size={18} />
              </button>
            </div>

            <div className="summary-strip">
              <div>
                <span>Total hours</span>
                <strong>142h</strong>
              </div>
              <div>
                <span>Completed</span>
                <strong>18</strong>
              </div>
              <div>
                <span>Short</span>
                <strong>2</strong>
              </div>
            </div>

            <div className="log-list">
              {sampleLogs.map((item) => (
                <div className="log-row" key={`${item.day}-${item.weekday}`}>
                  <div className="log-date">
                    <strong>{item.day}</strong>
                    <span>{item.weekday}</span>
                  </div>
                  <div className="log-time">
                    <span>{item.time}</span>
                    <strong>{item.total}</strong>
                  </div>
                  <span className={`badge badge-${item.tone}`}>{item.badge}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {screen === "settings" && (
          <section className="screen-content settings-content">
            <div className="settings-group">
              <h2>
                <IconClock size={18} />
                Shift config
              </h2>
              <label className="setting-row">
                <span>Target work hours</span>
                <strong>8h</strong>
              </label>
              <div className="weekday-row" aria-label="Working days">
                {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
            </div>

            <div className="settings-group">
              <h2>
                <IconBell size={18} />
                Notifications
              </h2>
              <label className="setting-row">
                <span>Notify when done</span>
                <Toggle checked />
              </label>
              <label className="setting-row">
                <span>Hourly reminder</span>
                <Toggle checked />
              </label>
              <label className="setting-row">
                <span>Sound</span>
                <Toggle checked />
              </label>
            </div>

            <div className="settings-group">
              <h2>
                <IconCalendarEvent size={18} />
                App
              </h2>
              <label className="setting-row">
                <span>Launch on Windows startup</span>
                <Toggle checked />
              </label>
              <label className="setting-row">
                <span>Minimize to system tray</span>
                <Toggle checked />
              </label>
              <div className="settings-actions">
                <button className="toolbar-button" type="button">
                  <IconWindowMinimize size={16} />
                  Tray
                </button>
                <button className="toolbar-button" type="button">
                  <IconDownload size={16} />
                  Export data
                </button>
              </div>
            </div>

            <div className="settings-note">
              <IconSpeakerphone size={16} />
              Local-only data storage
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
