import { contextBridge, ipcRenderer } from 'electron';
import type { Action, Snapshot } from '../shared/model';
contextBridge.exposeInMainWorld('flots', {
  getState: () => ipcRenderer.invoke('flots:state'),
  act: (action: Action) => ipcRenderer.invoke('flots:action', action),
  subscribe: (callback: (state: Snapshot) => void) => { const handler = (_e: Electron.IpcRendererEvent, state: Snapshot) => callback(state); ipcRenderer.on('flots:update', handler); return () => ipcRenderer.removeListener('flots:update', handler); },
  onCommand: (callback: (command: string, id?: string) => void) => { const handler = (_e: Electron.IpcRendererEvent, command: string, id?: string) => callback(command, id); ipcRenderer.on('flots:command', handler); return () => ipcRenderer.removeListener('flots:command', handler); }
});
