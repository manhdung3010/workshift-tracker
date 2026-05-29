import { contextBridge, ipcRenderer } from "electron";
const api = {
  appName: "WorkShift Tracker",
  getState: () => ipcRenderer.invoke("workshift:get-state"),
  checkIn: (nowIso) => ipcRenderer.invoke("workshift:check-in", nowIso),
  checkOut: (nowIso) => ipcRenderer.invoke("workshift:check-out", nowIso),
  updateRecord: (record) => ipcRenderer.invoke("workshift:update-record", record),
  updateSettings: (settingsPatch) => ipcRenderer.invoke("workshift:update-settings", settingsPatch),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  restoreWindow: () => ipcRenderer.invoke("window:restore"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  quitApp: () => ipcRenderer.invoke("app:quit")
};
contextBridge.exposeInMainWorld("workshift", api);
console.info("[preload] workshift bridge exposed");
