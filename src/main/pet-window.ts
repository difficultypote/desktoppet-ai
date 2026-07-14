// ============================================================
// pet-window.ts — 创建透明悬浮桌宠窗口
// ============================================================

import { BrowserWindow, screen } from 'electron';
import path from 'path';

export function createPetWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 340,   // 加宽以容纳对话气泡
    height: 520,  // 加高以容纳完整对话气泡（420 → 520）
    x: screenWidth - 360,
    y: screenHeight - 540,
    transparent: true, // 关键：透明背景
    frame: false, // 关键：无边框
    alwaysOnTop: true, // 关键：始终置顶
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true, // 不在任务栏显示
    hasShadow: false,
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发模式加载 Vite dev server，生产模式用 app:// 协议
  process.env.ELECTRON_RENDERER_URL
    ? win.loadURL(process.env.ELECTRON_RENDERER_URL + '/pet/index.html')
    : win.loadURL('app://renderer/pet/index.html');

  // Windows: 设置鼠标穿透，让点击穿过宠物窗口
  // forward: true 允许鼠标事件转发到渲染层（用于检测悬停）
  win.setIgnoreMouseEvents(true, { forward: true });

  return win;
}
