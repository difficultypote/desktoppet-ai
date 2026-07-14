// ============================================================
// preload.ts — 安全暴露 API 给渲染层
// 使用 contextBridge，不开启 nodeIntegration
// ============================================================

import { contextBridge, ipcRenderer } from 'electron';
import type { PetAPI, ConfigAPI } from '../shared/types';

// ---- 桌宠窗口 API ----
const petAPI: PetAPI = {
  setState: (state) => ipcRenderer.send('pet-set-state', state),

  onStateChange: (callback) => {
    const handler = (_event: unknown, state: Parameters<typeof callback>[0]) => callback(state);
    ipcRenderer.on('pet-state-changed', handler);
    return () => ipcRenderer.removeListener('pet-state-changed', handler);
  },

  onTasksUpdate: (callback) => {
    const handler = (_event: unknown, tasks: Parameters<typeof callback>[0]) => callback(tasks);
    ipcRenderer.on('tasks-update', handler);
    return () => ipcRenderer.removeListener('tasks-update', handler);
  },

  onStatusTextChange: (callback) => {
    const handler = (_event: unknown, text: string) => callback(text);
    ipcRenderer.on('status-text-changed', handler);
    return () => ipcRenderer.removeListener('status-text-changed', handler);
  },

  setInteractive: (interactive: boolean) => ipcRenderer.send('pet-set-interactive', interactive),
  startWindowDrag: () => ipcRenderer.send('pet-window-drag-start'),
  moveWindow: (deltaX: number, deltaY: number) => ipcRenderer.send('pet-window-move', { deltaX, deltaY }),
  endWindowDrag: () => ipcRenderer.send('pet-window-drag-end'),
  focusApp: () => ipcRenderer.send('pet-focus-app'),
  showContextMenu: () => ipcRenderer.send('pet-show-context-menu'),

  onHoverChange: (callback: (hovered: boolean) => void) => {
    const handler = (_event: unknown, hovered: boolean) => callback(hovered);
    ipcRenderer.on('pet-hover', handler);
    return () => ipcRenderer.removeListener('pet-hover', handler);
  },

  // 监听主进程切换对话气泡
  onToggleChat: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('toggle-chat', handler);
    return () => ipcRenderer.removeListener('toggle-chat', handler);
  },

  // 发送对话消息
  chat: (messages: any[]) => ipcRenderer.invoke('chat-send', messages),

  // 获取对话历史
  getHistory: () => ipcRenderer.invoke('history-get'),

  // 监听流式回复
  onChatStreamChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: unknown, chunk: string) => callback(chunk);
    ipcRenderer.on('chat-stream-chunk', handler);
    return () => ipcRenderer.removeListener('chat-stream-chunk', handler);
  },
  onChatStreamDone: (callback: (fullText: string) => void) => {
    const handler = (_event: unknown, fullText: string) => callback(fullText);
    ipcRenderer.on('chat-stream-done', handler);
    return () => ipcRenderer.removeListener('chat-stream-done', handler);
  },
  onChatStreamError: (callback: (error: string) => void) => {
    const handler = (_event: unknown, error: string) => callback(error);
    ipcRenderer.on('chat-stream-error', handler);
    return () => ipcRenderer.removeListener('chat-stream-error', handler);
  },

  getCurrentPet: () => ipcRenderer.invoke('pet-get-current'),

  onPetChange: (callback) => {
    const handler = (_event: unknown, pet: Parameters<typeof callback>[0]) => callback(pet);
    ipcRenderer.on('pet-changed', handler);
    return () => ipcRenderer.removeListener('pet-changed', handler);
  },

  getAnimationFps: () => ipcRenderer.invoke('pet-get-fps'),

  onAnimationFpsChange: (callback: (fps: number) => void) => {
    const handler = (_event: unknown, fps: number) => callback(fps);
    ipcRenderer.on('pet-fps-changed', handler);
    return () => ipcRenderer.removeListener('pet-fps-changed', handler);
  },

  isPetVisible: () => ipcRenderer.invoke('pet-is-visible'),

  setPetVisible: (visible: boolean) => ipcRenderer.send('pet-set-visible', visible),

  onVisibilityChange: (callback: (visible: boolean) => void) => {
    const handler = (_event: unknown, visible: boolean) => callback(visible);
    ipcRenderer.on('pet-visibility-changed', handler);
    return () => ipcRenderer.removeListener('pet-visibility-changed', handler);
  },
};

// ---- 配置窗口 API ----
const configAPI: ConfigAPI = {
  getConfig: () => ipcRenderer.invoke('config-get'),
  saveConfig: (config) => ipcRenderer.invoke('config-save', config),
  getPets: () => ipcRenderer.invoke('pets-list'),
  selectPet: (petId) => ipcRenderer.invoke('pet-select', petId),
  deletePet: (petId) => ipcRenderer.invoke('pet-delete', petId),
  uploadPet: (filePath, name, description) =>
    ipcRenderer.invoke('pet-upload', { filePath, name, description }),
  chat: (messages) => ipcRenderer.invoke('chat-send', messages),
  getHistory: () => ipcRenderer.invoke('history-get'),
  clearHistory: () => ipcRenderer.invoke('history-clear'),
  notifyPetState: (state, text) => ipcRenderer.send('pet-notify-state', { state, text }),
  previewPet: (petId, state) => ipcRenderer.send('pet-preview', { petId, state }),
};

// 根据当前页面 URL 判断暴露哪个 API
const isPetWindow = window.location.pathname.includes('pet');
const isConfigWindow = window.location.pathname.includes('config');

if (isPetWindow) {
  contextBridge.exposeInMainWorld('petAPI', petAPI);
}

if (isConfigWindow) {
  contextBridge.exposeInMainWorld('configAPI', configAPI);
}
