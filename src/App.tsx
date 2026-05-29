import {
  IconBell,
  IconArrowsMaximize,
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
import { addMonths, format, isSameMonth, subMonths } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { workdayLogRows } from "./domain/records";
import { effectiveWorkMinutes, shouldRemindToStart } from "./domain/schedule";
import { elapsedMinutes, formatDuration, progressRatio, shiftStatus } from "./domain/time";
import { workshiftApi } from "./lib/electronApi";
import type { WorkdayRecord, WorkshiftSettings, WorkshiftState } from "./types/workshift";

type Screen = "home" | "history" | "settings";

function statusLabel(status: ReturnType<typeof shiftStatus>): string {
  if (status === "not_started") return "Idle";
  if (status === "working") return "Working";
  if (status === "completed") return "Completed";
  return "Checked out";
}

function todayKey(now: Date): string {
  return format(now, "yyyy-MM-dd");
}

const weekdayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" }
] as const;

function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}): React.JSX.Element {
  return (
    <button
      className={`toggle-button ${checked ? "toggle-on" : ""}`}
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={() => onChange?.(!checked)}
    >
      <span aria-hidden="true" />
    </button>
  );
}

function targetHoursValue(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/\.00$/, "");
}

function notify(title: string, body: string): void {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, { body });
    return;
  }

  if (Notification.permission === "default") {
    void Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, { body });
      }
    });
  }
}

export function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>("home");
  const [state, setState] = useState<WorkshiftState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [showEarlyWarning, setShowEarlyWarning] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const lastStartReminderAt = useRef<Date | undefined>(undefined);
  const completedNotificationDate = useRef<string | undefined>(undefined);

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
  const compactStateLabel =
    status === "completed" ? "DONE" : status === "checked_out" ? "ENDED" : "LEFT";
  const canCheckIn = status === "not_started";
  const canEndNormally = status === "completed";
  const isWorking = status === "working" || status === "completed";
  const checkInLabel = todayRecord?.checkInAt ? format(new Date(todayRecord.checkInAt), "HH:mm") : "--:--";
  const estimatedEnd = todayRecord?.checkInAt
    ? format(new Date(new Date(todayRecord.checkInAt).getTime() + target * 60_000), "HH:mm")
    : "--:--";
  const monthRecords = state?.records.filter((record) => isSameMonth(new Date(record.date), selectedMonth)) ?? [];
  const monthlyMinutes = monthRecords.reduce(
    (total, record) => total + elapsedMinutes(record, now),
    0
  );
  const logRows = workdayLogRows(state?.records ?? [], format(selectedMonth, "yyyy-MM"), now);
  const completedLogCount = logRows.filter((row) => row.badge === "Full").length;
  const shortLogCount = logRows.filter((row) => row.badge === "Short").length;
  const settings = state?.settings;
  const effectiveMinutes = settings ? effectiveWorkMinutes(settings) : 0;
  const targetHours = settings ? targetHoursValue(settings.targetMinutes) : "8";

  useEffect(() => {
    if (!settings) {
      return;
    }

    if (settings.notifyOnComplete && status === "completed") {
      const key = todayKey(now);
      if (completedNotificationDate.current !== key) {
        completedNotificationDate.current = key;
        notify("WorkShift complete", "You have reached today's target work time.");
      }
    }

    if (
      shouldRemindToStart({
        settings,
        todayRecord,
        now,
        lastReminderAt: lastStartReminderAt.current
      })
    ) {
      lastStartReminderAt.current = now;
      notify("Start your shift", "You are inside your work window and have not started yet.");
    }
  }, [now, settings, status, todayRecord]);

  function handleMinimize(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
    setIsCompact(true);
    void workshiftApi.minimizeWindow();
  }

  function handleMinimizePointerDown(event: React.PointerEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
    setIsCompact(true);
    void workshiftApi.minimizeWindow();
  }

  function handleClose(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
    setIsCompact(true);
    void workshiftApi.minimizeWindow();
  }

  async function handleCheckIn(): Promise<void> {
    setShowEarlyWarning(false);
    setState(await workshiftApi.checkIn());
    setNow(new Date());
  }

  async function handleRestoreWindow(): Promise<void> {
    setIsCompact(false);
    await workshiftApi.restoreWindow();
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

  async function handleSettingsPatch(settingsPatch: Partial<WorkshiftSettings>): Promise<void> {
    setState(await workshiftApi.updateSettings(settingsPatch));
  }

  function handleWorkdayToggle(day: number): void {
    if (!settings) {
      return;
    }

    const workdays = settings.workdays.includes(day)
      ? settings.workdays.filter((item) => item !== day)
      : [...settings.workdays, day].sort((left, right) => left - right);

    void handleSettingsPatch({ workdays });
  }

  return (
    <main className={`app-frame ${isCompact ? "app-frame-compact" : ""}`}>
      <section className={`app-window ${isCompact ? "app-window-compact" : ""}`}>
        {isCompact ? (
          <section
            className={`compact-widget compact-status-${status}`}
            aria-label="Compact work shift widget"
          >
            <div className="compact-dragbar">
              <div className="compact-brand" aria-hidden="true">
                <span className="compact-mark">W</span>
                <i />
              </div>
              <button
                className="compact-zoom-button"
                type="button"
                aria-label="Zoom to full window"
                title="Zoom to full window"
                onClick={() => void handleRestoreWindow()}
              >
                <IconArrowsMaximize size={15} />
              </button>
            </div>

            <div className="compact-body">
              {canCheckIn ? (
                <button
                  className="compact-start-button"
                  type="button"
                  onClick={() => void handleCheckIn()}
                >
                  <IconPlayerPlay size={18} />
                  <span>START</span>
                </button>
              ) : (
                <div className="compact-countdown" aria-live="polite">
                  <span>{formatDuration(remaining)}</span>
                  <strong>{compactStateLabel}</strong>
                  <small>{estimatedEnd}</small>
                </div>
              )}
            </div>
          </section>
        ) : (
        <>
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
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setSelectedMonth((month) => subMonths(month, 1))}
              >
                <IconChevronLeft size={18} />
              </button>
              <strong>{format(selectedMonth, "MMMM yyyy")}</strong>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setSelectedMonth((month) => addMonths(month, 1))}
              >
                <IconChevronRight size={18} />
              </button>
            </div>

            <div className="summary-strip">
              <div>
                <span>Total hours</span>
                <strong>{formatDuration(monthlyMinutes)}</strong>
              </div>
              <div>
                <span>Completed</span>
                <strong>{completedLogCount}</strong>
              </div>
              <div>
                <span>Short</span>
                <strong>{shortLogCount}</strong>
              </div>
            </div>

            <div className="log-list">
              {logRows.length === 0 ? (
                <div className="empty-log">
                  <IconHistory size={18} />
                  <span>No saved work logs for this month</span>
                </div>
              ) : (
                logRows.map((item) => (
                  <div className="log-row" key={item.date}>
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
                ))
              )}
            </div>
          </section>
        )}

        {screen === "settings" && (
          <section className="screen-content settings-content">
            {settings && (
              <>
                <div className="settings-group">
                  <h2>
                    <IconClock size={18} />
                    Working schedule
                  </h2>
                  <div className="setting-grid">
                    <label>
                      <span>Work start</span>
                      <input
                        type="time"
                        value={settings.workStartTime}
                        onChange={(event) =>
                          void handleSettingsPatch({ workStartTime: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Work end</span>
                      <input
                        type="time"
                        value={settings.workEndTime}
                        onChange={(event) =>
                          void handleSettingsPatch({ workEndTime: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Lunch start</span>
                      <input
                        type="time"
                        value={settings.lunchStartTime}
                        onChange={(event) =>
                          void handleSettingsPatch({ lunchStartTime: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Lunch end</span>
                      <input
                        type="time"
                        value={settings.lunchEndTime}
                        onChange={(event) =>
                          void handleSettingsPatch({ lunchEndTime: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="setting-row setting-row-input">
                    <span>Required work hours</span>
                    <input
                      min="0"
                      step="0.25"
                      type="number"
                      value={targetHours}
                      onChange={(event) =>
                        void handleSettingsPatch({
                          targetMinutes: Math.max(0, Math.round(Number(event.target.value) * 60))
                        })
                      }
                    />
                  </label>
                  <div className="settings-metric">
                    <span>Effective schedule</span>
                    <strong>{formatDuration(effectiveMinutes)}</strong>
                  </div>
                  <div className="weekday-row" aria-label="Working days">
                    {weekdayOptions.map((day) => (
                      <button
                        className={settings.workdays.includes(day.value) ? "weekday-active" : ""}
                        key={day.value}
                        type="button"
                        onClick={() => handleWorkdayToggle(day.value)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-group">
                  <h2>
                    <IconBell size={18} />
                    Notifications
                  </h2>
                  <label className="setting-row">
                    <span>Notify when target is reached</span>
                    <Toggle
                      checked={settings.notifyOnComplete}
                      label="Toggle target reached notification"
                      onChange={(checked) =>
                        void handleSettingsPatch({ notifyOnComplete: checked })
                      }
                    />
                  </label>
                  <label className="setting-row">
                    <span>Remind if shift has not started</span>
                    <Toggle
                      checked={settings.notifyStartReminder}
                      label="Toggle start reminder notification"
                      onChange={(checked) =>
                        void handleSettingsPatch({ notifyStartReminder: checked })
                      }
                    />
                  </label>
                  <label className="setting-row setting-row-input">
                    <span>Reminder interval</span>
                    <div className="input-with-unit">
                      <input
                        min="1"
                        step="1"
                        type="number"
                        value={settings.startReminderIntervalMinutes}
                        onChange={(event) =>
                          void handleSettingsPatch({
                            startReminderIntervalMinutes: Math.max(
                              1,
                              Math.round(Number(event.target.value))
                            )
                          })
                        }
                      />
                      <span>min</span>
                    </div>
                  </label>
                </div>

                <div className="settings-group">
                  <h2>
                    <IconCalendarEvent size={18} />
                    App
                  </h2>
                  <label className="setting-row">
                    <span>Launch on Windows startup</span>
                    <Toggle
                      checked={settings.startAtLogin}
                      label="Toggle launch on Windows startup"
                      onChange={(checked) => void handleSettingsPatch({ startAtLogin: checked })}
                    />
                  </label>
                  <label className="setting-row">
                    <span>Compact widget</span>
                    <Toggle
                      checked={settings.showWidget}
                      label="Toggle compact widget"
                      onChange={(checked) => void handleSettingsPatch({ showWidget: checked })}
                    />
                  </label>
                  <div className="settings-actions">
                    <button
                      className="toolbar-button"
                      type="button"
                      onClick={() => {
                        setIsCompact(true);
                        void workshiftApi.minimizeWindow();
                      }}
                    >
                      <IconWindowMinimize size={16} />
                      Widget
                    </button>
                    <button className="toolbar-button" type="button">
                      <IconDownload size={16} />
                      Export data
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="settings-note">
              <IconSpeakerphone size={16} />
              Local-only data storage
            </div>
          </section>
        )}
        </>
        )}
      </section>
    </main>
  );
}
