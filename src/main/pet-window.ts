// ============================================================
// pet-window.ts — 创建透明悬浮桌宠窗口
// ============================================================

import { BrowserWindow, screen } from 'electron';
import path from 'path';

export function createPetWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 192,
    height: 208,
    x: screenWidth - 220, // 默认出现在右下角
    y: screenHeight - 240,
    transparent: true, // 关键：透明背景
    frame: false, // 关键：无边框
    alwaysOnTop: true, // 关键：始终置顶
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true, // 不在任务栏显示
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发模式加载 Vite dev server，生产模式加载打包后的文件
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173/src/renderer/pet/index.html');
  } else {
    win.loadFile(path.join(__dirname, '../renderer/pet/index.html'));
  }

  // Windows: 设置鼠标穿透，让点击穿过宠物窗口
  // forward: true 允许鼠标事件转发到渲染层（用于检测悬停）
  win.setIgnoreMouseEvents(true, { forward: true });

  return win;
}
