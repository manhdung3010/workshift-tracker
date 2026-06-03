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
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconSettings,
  IconSpeakerphone,
  IconTableExport,
  IconTimelineEvent,
  IconTrash,
  IconLogout2,
  IconX,
  IconWindowMinimize
} from "@tabler/icons-react";
import { addMonths, format, isSameMonth, subMonths } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildWorkdayRecordFromTimes, workdayLogRows } from "./domain/records";
import {
  effectiveWorkMinutes,
  estimatedShiftEndTime,
  progressRatioWithSchedule,
  remainingShiftMinutes,
  shiftStatusWithSchedule,
  shouldRemindToStart
} from "./domain/schedule";
import { dateWithTime, elapsedMinutes, formatDuration, progressRatio, shiftStatus } from "./domain/time";
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

function compactDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  return `${hours}:${remainingMinutes.toString().padStart(2, "0")}`;
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
  const [showDeleteTodayConfirm, setShowDeleteTodayConfirm] = useState(false);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [manualStartTime, setManualStartTime] = useState(() => format(new Date(), "HH:mm"));
  const [logEditMode, setLogEditMode] = useState<"add" | "edit">("edit");
  const [editingLogDate, setEditingLogDate] = useState<string | undefined>(undefined);
  const [editCheckInTime, setEditCheckInTime] = useState("");
  const [editCheckOutTime, setEditCheckOutTime] = useState("");
  const [editLogError, setEditLogError] = useState("");
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

  const settings = state?.settings;
  const status = settings
    ? shiftStatusWithSchedule(todayRecord, settings, now)
    : shiftStatus(todayRecord, now);
  const elapsed = todayRecord ? elapsedMinutes(todayRecord, now) : 0;
  const target = todayRecord?.targetMinutes ?? state?.settings.targetMinutes ?? 480;
  const progressPercent = Math.round(
    (settings
      ? progressRatioWithSchedule(todayRecord, settings, now)
      : progressRatio(todayRecord, now)) * 100
  );
  const remaining =
    todayRecord?.checkInAt && settings
      ? remainingShiftMinutes({
          settings,
          checkInAt: new Date(todayRecord.checkInAt),
          targetMinutes: target,
          now
        })
      : Math.max(0, target - elapsed);
  const canCheckIn = status === "not_started";
  const canEndNormally = status === "completed";
  const isWorking = status === "working" || status === "completed";
  const checkInLabel = todayRecord?.checkInAt ? format(new Date(todayRecord.checkInAt), "HH:mm") : "--:--";
  const estimatedEnd = todayRecord?.checkInAt && settings
    ? format(
        estimatedShiftEndTime({
          settings,
          checkInAt: new Date(todayRecord.checkInAt),
          targetMinutes: target
        }),
        "HH:mm"
      )
    : "--:--";
  const monthRecords = state?.records.filter((record) => isSameMonth(new Date(record.date), selectedMonth)) ?? [];
  const monthlyMinutes = monthRecords.reduce(
    (total, record) => total + elapsedMinutes(record, now),
    0
  );
  const logRows = workdayLogRows(state?.records ?? [], format(selectedMonth, "yyyy-MM"), now);
  const completedLogCount = logRows.filter((row) => row.badge === "Full").length;
  const shortLogCount = logRows.filter((row) => row.badge === "Short").length;
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
    setIsCompact(false);
    void workshiftApi.closeWindow();
  }

  async function handleCheckIn(): Promise<void> {
    setShowEarlyWarning(false);
    setShowStartTimeModal(false);
    setState(await workshiftApi.checkIn());
    setNow(new Date());
  }

  async function handleManualCheckIn(): Promise<void> {
    const startAt = dateWithTime(new Date(), manualStartTime);
    setShowEarlyWarning(false);
    setShowStartTimeModal(false);
    setState(await workshiftApi.checkIn(startAt));
    setNow(new Date());
  }

  async function handleDeleteTodayLog(): Promise<void> {
    if (!todayRecord) {
      return;
    }

    setShowDeleteTodayConfirm(false);
    setShowEarlyWarning(false);
    setShowStartTimeModal(false);
    setState(await workshiftApi.deleteRecord(todayRecord.date));
    setNow(new Date());
  }

  function handleOpenStartTimeModal(): void {
    setShowDeleteTodayConfirm(false);
    setManualStartTime(format(new Date(), "HH:mm"));
    setShowStartTimeModal(true);
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

  function handleTestNotification(): void {
    notify("WorkShift test", "Notifications are working on this device.");
  }

  function handleOpenAddLog(): void {
    setLogEditMode("add");
    setEditingLogDate(format(selectedMonth, "yyyy-MM-dd"));
    setEditCheckInTime(settings?.workStartTime ?? "09:00");
    setEditCheckOutTime(settings?.workEndTime ?? "18:00");
    setEditLogError("");
  }

  function handleOpenEditLog(record: WorkdayRecord): void {
    setLogEditMode("edit");
    setEditingLogDate(record.date);
    setEditCheckInTime(record.checkInAt ? format(new Date(record.checkInAt), "HH:mm") : "");
    setEditCheckOutTime(record.checkOutAt ? format(new Date(record.checkOutAt), "HH:mm") : "");
    setEditLogError("");
  }

  async function handleSaveLogEdit(): Promise<void> {
    const record = state?.records.find((item) => item.date === editingLogDate);
    const targetMinutes = settings?.targetMinutes ?? 480;

    if (!editingLogDate || !editCheckInTime) {
      setEditLogError("Check-in time is required.");
      return;
    }

    if (!editCheckOutTime) {
      setEditLogError("Check-out time is required.");
      return;
    }

    const nextRecord = buildWorkdayRecordFromTimes({
      existing: record,
      date: editingLogDate,
      checkInTime: editCheckInTime,
      checkOutTime: editCheckOutTime,
      targetMinutes
    });

    if (
      nextRecord.checkOutAt &&
      new Date(nextRecord.checkOutAt).getTime() < new Date(nextRecord.checkInAt ?? "").getTime()
    ) {
      setEditLogError("Check-out must be after check-in.");
      return;
    }

    setState(await workshiftApi.updateRecord(nextRecord));
    setEditingLogDate(undefined);
    setEditLogError("");
    setNow(new Date());
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
              <span className="compact-drag-handle" aria-hidden="true" />
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
                  <span>{compactDuration(remaining)}</span>
                  <strong>Shift Ends {estimatedEnd}</strong>
                  <div className="compact-progress" aria-hidden="true">
                    <i style={{ width: `${progressPercent}%` }} />
                  </div>
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
              style={
                isWorking
                  ? ({ "--shift-progress": `${progressPercent}%` } as React.CSSProperties)
                  : undefined
              }
              onClick={() => void handleCheckIn()}
            >
              {isWorking ? (
                <span className="shift-progress-ring" aria-label={`${progressPercent}% complete`}>
                  <strong>{progressPercent}%</strong>
                  <small>{formatDuration(remaining)}</small>
                </span>
              ) : (
                <>
                  <IconPlayerPlay size={28} />
                  <span>START SHIFT</span>
                </>
              )}
            </button>

            {canCheckIn && (
              <button
                className="manual-start-button"
                type="button"
                onClick={handleOpenStartTimeModal}
              >
                <IconPencil size={16} />
                Choose start time
              </button>
            )}

            {showStartTimeModal && canCheckIn && (
              <div className="warning-modal start-time-modal" role="dialog" aria-label="Choose start time">
                <strong>Choose start time</strong>
                <label>
                  <span>Start time</span>
                  <input
                    type="time"
                    value={manualStartTime}
                    max={format(now, "HH:mm")}
                    onChange={(event) => setManualStartTime(event.target.value)}
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowStartTimeModal(false)}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => void handleManualCheckIn()}>
                    Start
                  </button>
                </div>
              </div>
            )}

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

            {todayRecord && (
              <>
                <button
                  className="delete-log-button"
                  type="button"
                  onClick={() => {
                    setShowEarlyWarning(false);
                    setShowDeleteTodayConfirm(true);
                  }}
                >
                  <IconTrash size={16} />
                  Delete today log
                </button>

                {showDeleteTodayConfirm && (
                  <div className="warning-modal delete-log-modal" role="dialog" aria-label="Delete today log">
                    <strong>Delete today log?</strong>
                    <p>This will remove today's check-in, checkout, and total time.</p>
                    <div className="modal-actions">
                      <button type="button" onClick={() => setShowDeleteTodayConfirm(false)}>
                        Cancel
                      </button>
                      <button type="button" onClick={() => void handleDeleteTodayLog()}>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </>
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

            <div className="log-actions">
              <button className="toolbar-button" type="button" onClick={handleOpenAddLog}>
                <IconPlus size={16} />
                Add log
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
                logRows.map((item) => {
                  const record = state?.records.find((entry) => entry.date === item.date);

                  return (
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
                      {record?.checkInAt && (
                        <button
                          className="log-edit-button"
                          type="button"
                          aria-label={`Edit log for ${item.date}`}
                          title="Edit log"
                          onClick={() => handleOpenEditLog(record)}
                        >
                          <IconPencil size={15} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {editingLogDate && (
              <div className="warning-modal edit-log-modal" role="dialog" aria-label="Edit work log">
                <strong>{logEditMode === "add" ? "Add work log" : "Edit work log"}</strong>
                {logEditMode === "add" ? (
                  <label className="edit-log-date">
                    <span>Date</span>
                    <input
                      type="date"
                      value={editingLogDate}
                      onChange={(event) => setEditingLogDate(event.target.value)}
                    />
                  </label>
                ) : (
                  <p>{format(new Date(`${editingLogDate}T00:00:00`), "EEEE, dd MMMM yyyy")}</p>
                )}
                <div className="edit-log-grid">
                  <label>
                    <span>Check-in</span>
                    <input
                      type="time"
                      value={editCheckInTime}
                      onChange={(event) => setEditCheckInTime(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Check-out</span>
                    <input
                      type="time"
                      value={editCheckOutTime}
                      onChange={(event) => setEditCheckOutTime(event.target.value)}
                    />
                  </label>
                </div>
                {editLogError && <p className="modal-error">{editLogError}</p>}
                <div className="modal-actions">
                  <button type="button" onClick={() => setEditingLogDate(undefined)}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => void handleSaveLogEdit()}>
                    Save
                  </button>
                </div>
              </div>
            )}
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
                  <div className="settings-actions notification-actions">
                    <button
                      className="toolbar-button"
                      type="button"
                      onClick={handleTestNotification}
                    >
                      <IconBell size={16} />
                      Test notification
                    </button>
                  </div>
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

            <div className="settings-note" style={{ marginTop: "1em" }}>
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
