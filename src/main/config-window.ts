// ============================================================
// config-window.ts — 创建配置窗口（普通窗口风格）
// ============================================================

import { BrowserWindow } from 'electron';
import path from 'path';

export function createConfigWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 680,
    title: 'DesktopPet 设置',
    frame: true, // 有标题栏
    alwaysOnTop: false, // 不置顶
    show: false, // 默认隐藏，通过托盘打开
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173/src/renderer/config/index.html');
  } else {
    win.loadFile(path.join(__dirname, '../renderer/config/index.html'));
  }

  // 关闭时隐藏而不是退出（保持托盘运行）
  win.on('close', (e) => {
    e.preventDefault();
    win.hide();
  });

  return win;
}
