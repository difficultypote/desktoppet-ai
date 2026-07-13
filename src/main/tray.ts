// ============================================================
// tray.ts — 系统托盘图标与右键菜单
// ============================================================

import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron';
import path from 'path';

export function createTray(
  petWin: BrowserWindow,
  configWin: BrowserWindow,
): Tray {
  // 尝试加载托盘图标，如果不存在则使用空图标
  let icon: Electron.NativeImage;
  const iconPath = process.env.NODE_ENV === 'development'
    ? path.join(process.cwd(), 'resources', 'tray-icon.png')
    : path.join(__dirname, '..', 'resources', 'tray-icon.png');
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      // 使用 16x16 透明占位图标
      icon = nativeImage.createEmpty();
    }
  } catch {
    icon = nativeImage.createEmpty();
  }

  // Windows 托盘图标建议 16x16
  icon = icon.resize({ width: 16, height: 16 });

  const tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏宠物',
      click: () => {
        if (petWin.isVisible()) {
          petWin.hide();
        } else {
          petWin.show();
        }
      },
    },
    {
      label: '打开设置',
      click: () => {
        configWin.show();
        configWin.focus();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        // 允许配置窗口真正关闭
        configWin.removeAllListeners('close');
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('DesktopPet AI');

  // 双击托盘图标切换宠物可见性
  tray.on('double-click', () => {
    if (petWin.isVisible()) {
      petWin.hide();
    } else {
      petWin.show();
    }
  });

  return tray;
}
