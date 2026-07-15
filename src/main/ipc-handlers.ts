// ============================================================
// ipc-handlers.ts — IPC 通信（窗口间消息中转）
// ============================================================

import { ipcMain, BrowserWindow, dialog, screen, Menu } from 'electron';
import type {
  LLMConfig,
  ChatMessage,
  AIServiceState,
  PetAnimationState,
  PetMetadata,
} from '../shared/types';
import { STATE_MAP } from '../shared/constants';
import {
  listPets,
  getCurrentPet,
  setCurrentPetId,
  deletePet,
  getPetMetadata,
} from './pet-loader';
import {
  loadConfig,
  saveConfig,
  loadHistory,
  saveHistory,
  clearHistory,
  chatStream,
} from './ai-service';
import { importPetPackage } from './pet-importer/index';

let petWin: BrowserWindow | null = null;
let configWin: BrowserWindow | null = null;

/** 当前状态定时器（用于自动恢复 idle） */
let stateTimer: NodeJS.Timeout | null = null;

/** 窗口拖拽起始信息 */
let dragStart: { mouseX: number; mouseY: number; winX: number; winY: number } | null = null;

/** 鼠标穿透轮询定时器 */
let hoverPollTimer: NodeJS.Timeout | null = null;

/** 当前是否已关闭穿透（鼠标在桌宠上方） */
let isCurrentlyInteractive = false;

/** 是否正在拖拽窗口 */
let isDraggingWindow = false;

/** 对话气泡是否打开（打开时整个窗口都需要交互） */
let chatBubbleOpen = false;

/**
 * 启动鼠标穿透轮询
 * 每 50ms 检查一次鼠标是否在桌宠窗口内
 * 在主进程中用 screen.getCursorScreenPoint() 获取鼠标位置
 * 避免渲染层事件驱动的穿透切换抖动
 */
function startHoverPolling(): void {
  if (hoverPollTimer) return;

  hoverPollTimer = setInterval(() => {
    if (!petWin || petWin.isDestroyed() || !petWin.isVisible()) return;

    // 拖拽中保持交互状态
    if (isDraggingWindow) return;

    const cursor = screen.getCursorScreenPoint();
    const [winX, winY] = petWin.getPosition();
    const [winW, winH] = petWin.getSize();

    let isOver: boolean;
    if (chatBubbleOpen) {
      // 对话气泡打开时，整个窗口都需要可交互
      isOver =
        cursor.x >= winX &&
        cursor.x <= winX + winW &&
        cursor.y >= winY &&
        cursor.y <= winY + winH;
    } else {
      // 气泡关闭时，只检测桌宠 canvas 区域（右下角 192x208）
      const petW = 192;
      const petH = 208;
      const petLeft = winX + winW - petW;
      const petTop = winY + winH - petH;
      isOver =
        cursor.x >= petLeft &&
        cursor.x <= petLeft + petW &&
        cursor.y >= petTop &&
        cursor.y <= petTop + petH;
    }

    if (isOver && !isCurrentlyInteractive) {
      // 鼠标进入 → 关闭穿透
      isCurrentlyInteractive = true;
      petWin.setIgnoreMouseEvents(false);
      petWin.webContents.send('pet-hover', true);
    } else if (!isOver && isCurrentlyInteractive) {
      // 鼠标离开 → 恢复穿透
      isCurrentlyInteractive = false;
      petWin.setIgnoreMouseEvents(true, { forward: true });
      petWin.webContents.send('pet-hover', false);
    }
  }, 50);
}

/**
 * 停止鼠标穿透轮询
 */
function stopHoverPolling(): void {
  if (hoverPollTimer) {
    clearInterval(hoverPollTimer);
    hoverPollTimer = null;
  }
}

/**
 * 注册所有 IPC 处理器
 */
export function registerIpcHandlers(
  petWindow: BrowserWindow,
  configWindow: BrowserWindow,
): void {
  petWin = petWindow;
  configWin = configWindow;

  // ============================================================
  // 桌宠窗口 → 主进程
  // ============================================================

  // 启动鼠标穿透轮询（主进程负责检测 hover）
  startHoverPolling();

  // 桌宠状态切换
  ipcMain.on('pet-set-state', (_event, state: PetAnimationState) => {
    sendPetState(state);
  });

  // 渲染层不再控制穿透，由主进程轮询管理
  // 保留 set-interactive 仅供拖拽等特殊场景使用
  ipcMain.on('pet-set-interactive', (_event, interactive: boolean) => {
    if (interactive) {
      petWin?.setIgnoreMouseEvents(false);
    } else {
      petWin?.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  // 开始手动拖拽窗口
  ipcMain.on('pet-window-drag-start', () => {
    const cursor = screen.getCursorScreenPoint();
    const [winX, winY] = petWin ? petWin.getPosition() : [0, 0];
    dragStart = { mouseX: cursor.x, mouseY: cursor.y, winX, winY };
    isDraggingWindow = true;
  });

  // 拖拽窗口 — 主进程用 screen.getCursorScreenPoint 直接移动
  ipcMain.on('pet-window-move', () => {
    if (!dragStart || !petWin) return;
    const cursor = screen.getCursorScreenPoint();
    const deltaX = cursor.x - dragStart.mouseX;
    const deltaY = cursor.y - dragStart.mouseY;
    petWin.setPosition(dragStart.winX + deltaX, dragStart.winY + deltaY);
  });

  // 结束拖拽
  ipcMain.on('pet-window-drag-end', () => {
    dragStart = null;
    isDraggingWindow = false;
    // 拖拽结束后重置交互状态，让轮询重新检测
    isCurrentlyInteractive = true; // 鼠标松开时通常还在窗口上
  });

  // 单击桌宠：切换对话气泡（不再打开设置窗口）
  ipcMain.on('pet-focus-app', () => {
    chatBubbleOpen = !chatBubbleOpen;
    // 通知桌宠渲染层切换对话模式
    petWin?.webContents.send('toggle-chat');
    // 对话气泡打开时立即关闭穿透
    if (chatBubbleOpen) {
      petWin?.setIgnoreMouseEvents(false);
      isCurrentlyInteractive = true;
    }
  });

  // 右键菜单：使用 Electron 原生菜单（不受窗口边界限制）
  ipcMain.on('pet-show-context-menu', () => {
    if (!petWin) return;

    const menu = Menu.buildFromTemplate([
      {
        label: '打开设置',
        click: () => {
          if (configWin && !configWin.isDestroyed()) {
            configWin.show();
            configWin.focus();
          }
        },
      },
      { type: 'separator' },
      {
        label: '跳一下',
        click: () => {
          sendPetState('jumping');
          // 2 秒后自动恢复 idle
          scheduleStateReset(2000);
        },
      },
      {
        label: '挥挥手',
        click: () => {
          sendPetState('waving');
          // 3 秒后自动恢复 idle
          scheduleStateReset(3000);
        },
      },
      {
        label: '跑一跑',
        click: () => {
          sendPetState('running-right');
          scheduleStateReset(3000);
        },
      },
      {
        label: '发呆',
        click: () => {
          sendPetState('waiting');
          scheduleStateReset(3000);
        },
      },
      { type: 'separator' },
      {
        label: '回到待机',
        click: () => {
          if (stateTimer) {
            clearTimeout(stateTimer);
            stateTimer = null;
          }
          sendPetState('idle');
          petWin?.webContents.send('status-text-changed', '');
        },
      },
      { type: 'separator' },
      {
        label: '隐藏宠物',
        click: () => {
          petWin?.hide();
          petWin?.webContents.send('pet-visibility-changed', false);
          configWin?.webContents.send('pet-visibility-changed', false);
        },
      },
      {
        label: '退出',
        click: () => {
          require('electron').app.quit();
        },
      },
    ]);

    menu.popup({ window: petWin });
  });

  // 获取当前宠物
  ipcMain.handle('pet-get-current', () => {
    return getCurrentPet();
  });

  // 获取动画帧速
  ipcMain.handle('pet-get-fps', () => {
    const config = loadConfig();
    return config.animationFps || 12;
  });

  // 获取宠物可见性
  ipcMain.handle('pet-is-visible', () => {
    return petWin?.isVisible() ?? false;
  });

  // 显示/隐藏宠物
  ipcMain.on('pet-set-visible', (_event, visible: boolean) => {
    if (!petWin) return;
    if (visible) {
      petWin.show();
    } else {
      petWin.hide();
    }
    // 通知所有窗口
    petWin.webContents.send('pet-visibility-changed', visible);
    configWin?.webContents.send('pet-visibility-changed', visible);
  });

  // ============================================================
  // 配置窗口 → 主进程
  // ============================================================

  // 获取 LLM 配置
  ipcMain.handle('config-get', () => {
    return loadConfig();
  });

  // 保存 LLM 配置
  ipcMain.handle('config-save', (_event, config: LLMConfig) => {
    const oldConfig = loadConfig();
    saveConfig(config);
    // 动画帧速变化时通知桌宠窗口
    const oldFps = (oldConfig as any).animationFps || 12;
    const newFps = (config as any).animationFps || 12;
    if (oldFps !== newFps) {
      petWin?.webContents.send('pet-fps-changed', newFps);
    }
  });

  // 列出所有宠物
  ipcMain.handle('pets-list', () => {
    return listPets();
  });

  // 切换当前宠物
  ipcMain.handle('pet-select', (_event, petId: string) => {
    setCurrentPetId(petId);
    const pet = getPetMetadata(petId);
    if (pet) {
      // 通知桌宠窗口宠物已切换
      petWin?.webContents.send('pet-changed', pet);
    }
  });

  // 删除宠物
  ipcMain.handle('pet-delete', (_event, petId: string) => {
    deletePet(petId);
  });

  // 上传宠物包
  ipcMain.handle(
    'pet-upload',
    async (_event, { filePath, name, description }: { filePath: string; name: string; description: string }) => {
      try {
        const result = await importPetPackage(filePath, name, description);
        // 通知配置窗口刷新宠物列表
        configWin?.webContents.send('pets-updated');
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`导入失败: ${msg}`);
      }
    },
  );

  // 发送对话消息 — 驱动桌宠状态（实际聊天通过 HTTP SSE）
  ipcMain.handle('chat-send', async (_event, messages: ChatMessage[]) => {
    const config = loadConfig();
    let fullContent = '';

    try {
      // 异步流式调用，驱动桌宠状态
      await chatStream(messages, config, {
        onState: (state: AIServiceState, text?: string) => {
          const petState = STATE_MAP[state];
          sendPetState(petState);
          if (text) {
            petWin?.webContents.send('status-text-changed', text);
          }
        },
        onContent: (chunk: string) => {
          fullContent += chunk;
          // 实时推送流式内容给桌宠窗口
          petWin?.webContents.send('chat-stream-chunk', chunk);
        },
        onError: (error: string) => {
          sendPetState('failed');
          petWin?.webContents.send('status-text-changed', `出错了: ${error}`);
          petWin?.webContents.send('chat-stream-error', error);
          scheduleStateReset(5000);
        },
        onDone: () => {
          // 保存到历史记录
          const history = loadHistory();
          history.push(...messages);
          history.push({
            role: 'assistant',
            content: fullContent,
            timestamp: Date.now(),
          });
          saveHistory(history);
          // 通知桌宠窗口对话完成
          petWin?.webContents.send('chat-stream-done', fullContent);
          scheduleStateReset(3000);
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[IPC] chat-send error:', errorMsg);
      petWin?.webContents.send('chat-stream-error', `内部错误: ${errorMsg}`);
    }

    return { ok: true };
  });

  // 获取对话历史
  ipcMain.handle('history-get', () => {
    return loadHistory();
  });

  // 清空对话历史
  ipcMain.handle('history-clear', () => {
    clearHistory();
  });

  // 配置窗口通知桌宠切换状态
  ipcMain.on('pet-notify-state', (_event, { state, text }: { state: AIServiceState; text?: string }) => {
    const petState = STATE_MAP[state];
    sendPetState(petState);
    if (text) {
      petWin?.webContents.send('status-text-changed', text);
    }
  });

  // 预览宠物动画
  ipcMain.on('pet-preview', (_event, { petId, state }: { petId: string; state: PetAnimationState }) => {
    // 在配置窗口中预览，不需要切换桌宠
    // 配置窗口自己处理预览渲染
  });

  // 选择文件对话框（用于上传宠物）
  ipcMain.handle('dialog-open-file', async () => {
    if (!configWin) return null;
    const result = await dialog.showOpenDialog(configWin, {
      title: '选择宠物包文件',
      filters: [
        { name: '宠物包', extensions: ['zip', '7z', 'rar'] },
        { name: '图片', extensions: ['png', 'gif', 'webp', 'jpg', 'jpeg'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

/**
 * 向桌宠窗口发送状态切换
 */
function sendPetState(state: PetAnimationState): void {
  // 清除之前的定时器
  if (stateTimer) {
    clearTimeout(stateTimer);
    stateTimer = null;
  }
  petWin?.webContents.send('pet-state-changed', state);
}

/**
 * 定时恢复 idle 状态
 */
function scheduleStateReset(delay: number): void {
  if (stateTimer) clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    petWin?.webContents.send('pet-state-changed', 'idle' as PetAnimationState);
    petWin?.webContents.send('status-text-changed', '');
    stateTimer = null;
  }, delay);
}

/**
 * 通知桌宠窗口宠物已切换
 */
export function notifyPetChanged(pet: PetMetadata): void {
  petWin?.webContents.send('pet-changed', pet);
}
