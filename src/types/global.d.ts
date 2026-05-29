import type { WorkshiftApi } from "./electron-api";

declare global {
  interface Window {
    workshift: WorkshiftApi;
  }
}

export {};
