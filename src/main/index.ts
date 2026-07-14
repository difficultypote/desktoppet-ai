// ============================================================
// index.ts — Electron 主进程入口
// 创建两个窗口 + 托盘 + IPC + HTTP 服务器
// ============================================================

import { app, BrowserWindow, Menu, protocol, net } from 'electron';
import path from 'path';
import { createPetWindow } from './pet-window';
import { createConfigWindow } from './config-window';
import { createTray } from './tray';
import { registerIpcHandlers } from './ipc-handlers';
import { startHttpServer } from './http-server';
import { ensureDefaultPet, getCurrentPet } from './pet-loader';
import { notifyPetChanged } from './ipc-handlers';

// 添加命令行参数，绕过沙箱限制
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('ignore-certificate-errors');

// 将用户数据目录设置到系统 AppData（打包后可正常写入）
// 开发模式使用项目内 .electron-data 目录
if (!app.isPackaged) { app.setPath('userData', path.join(process.cwd(), '.electron-data')); }

// ============================================================
// 注册自定义协议 app://
// 生产模式下用 app://renderer/pet/index.html 代替 file:// 协议
// 解决 file:// 协议下 ES module 无法加载的问题
// ============================================================
let rendererBasePath: string;

if (app.isPackaged) {
  rendererBasePath = path.join(__dirname, '../renderer');
} else {
  rendererBasePath = path.join(__dirname, '../../out/renderer');
}

// 开发模式下注册标准协议，生产模式也用标准协议（支持 fetch/import）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

// 禁用硬件加速可能导致的透明窗口问题（按需启用）
// app.disableHardwareAcceleration();

let petWin: BrowserWindow | null = null;
let configWin: BrowserWindow | null = null;

app.whenReady().then(() => {
  console.log('[DesktopPet] App ready, initializing...');

  // 注册 app:// 协议处理器
  protocol.handle('app', (request) => {
    // 将 app://renderer/pet/index.html 转换为文件路径
    const url = new URL(request.url);
    const relativePath = url.pathname.replace(/^\//, '');
    const filePath = path.join(rendererBasePath, relativePath);

    console.log(`[DesktopPet] Protocol: ${request.url} -> ${filePath}`);
    return net.fetch(`file://${filePath.replace(/\\/g, '/')}`);
  });
  console.log('[DesktopPet] Protocol app:// registered');

  try {
    // 确保默认宠物存在
    ensureDefaultPet();
    console.log('[DesktopPet] Default pet ensured');
  } catch (err) {
    console.error('[DesktopPet] Failed to ensure default pet:', err);
  }

  // 创建桌宠窗口
  petWin = createPetWindow();
  console.log('[DesktopPet] Pet window created');

  // 创建配置窗口（默认隐藏）
  configWin = createConfigWindow();
  console.log('[DesktopPet] Config window created');

  // 创建系统托盘
  createTray(petWin, configWin);
  console.log('[DesktopPet] Tray created');

  // 注册 IPC 处理器
  registerIpcHandlers(petWin, configWin);
  console.log('[DesktopPet] IPC handlers registered');

  // 启动内嵌 HTTP 服务器
  try {
    startHttpServer();
    console.log('[DesktopPet] HTTP server started on port 31750');
  } catch (err) {
    console.error('[DesktopPet] Failed to start HTTP server:', err);
  }

  // 通知桌宠窗口当前宠物信息
  const currentPet = getCurrentPet();
  if (currentPet) {
    setTimeout(() => {
      notifyPetChanged(currentPet);
    }, 1000); // 延迟 1 秒等渲染层加载完成
  }

  // Windows: 隐藏菜单栏
  Menu.setApplicationMenu(null);

  console.log('[DesktopPet] Application started successfully');
});

// 捕获未处理的异常
process.on('uncaughtException', (err) => {
  console.error('[DesktopPet] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[DesktopPet] Unhandled rejection:', reason);
});

// 所有窗口关闭时不退出（保持托盘运行）
app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});

// 激活时重新显示（macOS 行为，Windows 也兼容）
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    petWin = createPetWindow();
    configWin = createConfigWindow();
  }
});

// 安全设置：阻止新窗口创建
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // 阻止所有新窗口弹出，改为在默认浏览器打开
    if (url.startsWith('http')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });
});
