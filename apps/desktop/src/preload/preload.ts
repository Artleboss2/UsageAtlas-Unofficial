import { contextBridge, ipcRenderer } from "electron";
import type { EngineStatus, UsageAtlasDesktopAPI } from "../shared/desktop-api";
import { IPC } from "../shared/desktop-api";

const api: UsageAtlasDesktopAPI = {
  platform: process.platform,
  minimizeWindow: () => ipcRenderer.invoke(IPC.minimizeWindow),
  toggleMaximizeWindow: () => ipcRenderer.invoke(IPC.toggleMaximizeWindow),
  closeWindow: () => ipcRenderer.invoke(IPC.closeWindow),
  getWindowState: () => ipcRenderer.invoke(IPC.getWindowState),
  onWindowMaximized: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) => listener(maximized);
    ipcRenderer.on(IPC.windowMaximized, handler);
    return () => ipcRenderer.removeListener(IPC.windowMaximized, handler);
  },
  getProviderCredentials: () => ipcRenderer.invoke(IPC.getProviderCredentials),
  setProviderCredential: (provider, credential) => ipcRenderer.invoke(IPC.setProviderCredential, provider, credential),
  getUpdateState: () => ipcRenderer.invoke(IPC.getUpdateState),
  checkForUpdates: () => ipcRenderer.invoke(IPC.checkForUpdates),
  installUpdate: () => ipcRenderer.invoke(IPC.installUpdate),
  onUpdateState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]) => listener(state);
    ipcRenderer.on(IPC.updateStateChanged, handler);
    return () => ipcRenderer.removeListener(IPC.updateStateChanged, handler);
  },
  getCloudStatus: () => ipcRenderer.invoke(IPC.cloudStatus),
  cloudAction: (action, options) => ipcRenderer.invoke(IPC.cloudAction, action, options),
  checkHandle: (handle) => ipcRenderer.invoke(IPC.checkHandle, handle),
  getLeaderboard: () => ipcRenderer.invoke(IPC.getLeaderboard),
  copyText: (text) => ipcRenderer.invoke(IPC.copyText, text),
  copyImage: (png) => ipcRenderer.invoke(IPC.copyImage, png),
  saveImage: (png, fileName) => ipcRenderer.invoke(IPC.saveImage, png, fileName),
  trackGrowthEvent: (event, properties) => ipcRenderer.invoke(IPC.trackGrowthEvent, event, properties),
  getCustomBackground: () => ipcRenderer.invoke(IPC.getCustomBackground),
  chooseCustomBackground: () => ipcRenderer.invoke(IPC.chooseCustomBackground),
  getSnapshot: () => ipcRenderer.invoke(IPC.snapshot),
  refreshAll: () => ipcRenderer.invoke(IPC.refreshAll),
  setProviderEnabled: (providerID, enabled) => ipcRenderer.invoke(IPC.setProviderEnabled, providerID, enabled),
  setReportPlans: (plans) => ipcRenderer.invoke(IPC.setReportPlans, plans),
  getPreferences: () => ipcRenderer.invoke(IPC.getPreferences),
  updatePreferences: (patch) => ipcRenderer.invoke(IPC.updatePreferences, patch),
  getDiagnostics: () => ipcRenderer.invoke(IPC.getDiagnostics),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  onEngineStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, status: EngineStatus) => listener(status);
    ipcRenderer.on(IPC.engineStatus, handler);
    return () => ipcRenderer.removeListener(IPC.engineStatus, handler);
  },
  onNavigate: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, route: Parameters<typeof listener>[0]) => listener(route);
    ipcRenderer.on(IPC.navigate, handler);
    return () => ipcRenderer.removeListener(IPC.navigate, handler);
  },
  onSnapshot: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: Parameters<typeof listener>[0]) => listener(snapshot);
    ipcRenderer.on(IPC.snapshotUpdated, handler);
    return () => ipcRenderer.removeListener(IPC.snapshotUpdated, handler);
  }
};

contextBridge.exposeInMainWorld("usageAtlas", Object.freeze(api));
