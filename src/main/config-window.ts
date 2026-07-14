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
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  process.env.ELECTRON_RENDERER_URL
    ? win.loadURL(process.env.ELECTRON_RENDERER_URL + '/config/index.html')
    : win.loadURL('app://renderer/config/index.html');

  // 关闭时隐藏而不是退出（保持托盘运行）
  win.on('close', (e) => {
    e.preventDefault();
    win.hide();
  });

  return win;
}
