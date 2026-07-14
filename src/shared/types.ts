// ============================================================
// 共享类型定义 — 两个窗口（pet / config）共用
// ============================================================

/** 宠物动画状态（对应 spritesheet 的 9 行） */
export type PetAnimationState =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review';

/** AI 服务状态信号 → 桌宠动画状态映射 */
export type AIServiceState =
  | 'idle'
  | 'thinking'
  | 'generating'
  | 'waiting-input'
  | 'error'
  | 'done';

/** 宠物元数据（pet.json 结构） */
export interface PetMetadata {
  id: string;
  name: string;
  description?: string;
  spritesheet: string;
  version?: string;
  author?: string;
  tags?: string[];
}

/** LLM API 配置 */
export interface LLMConfig {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  /** 宠物动画帧率（1~30，默认 12） */
  animationFps: number;
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

/** 桌宠任务（多任务并行时） */
export interface PetTask {
  id: string;
  title: string;
  state: PetAnimationState;
}

/** SSE 流式响应中的状态事件 */
export interface SSEStateEvent {
  state: AIServiceState;
  content?: string;
  error?: string;
}

/** 宠物格式类型 */
export type PetFormat =
  | 'codex'
  | 'shimeji'
  | 'live2d'
  | 'gif'
  | 'frames'
  | 'single'
  | 'unknown';

/** 导入进度步骤 */
export interface ImportStep {
  label: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  detail?: string;
}

/** 宠物包导入结果 */
export interface PetPackage {
  metadata: PetMetadata;
  spritesheetPath: string;
  warnings: string[];
}

/** preload 暴露给渲染层的 API */
export interface PetAPI {
  /** 切换宠物动画状态 */
  setState: (state: PetAnimationState) => void;
  /** 监听状态变化 */
  onStateChange: (callback: (state: PetAnimationState) => void) => () => void;
  /** 监听任务列表更新 */
  onTasksUpdate: (callback: (tasks: PetTask[]) => void) => () => void;
  /** 监听状态文本更新 */
  onStatusTextChange: (callback: (text: string) => void) => () => void;
  /** 关闭鼠标穿透（鼠标进入桌宠区域时调用） */
  setInteractive: (interactive: boolean) => void;
  /** 开始手动拖拽窗口 */
  startWindowDrag: () => void;
  /** 拖拽窗口（传入鼠标增量） */
  moveWindow: (deltaX: number, deltaY: number) => void;
  /** 结束拖拽窗口 */
  endWindowDrag: () => void;
  /** 单击桌宠 — 切回主应用窗口 */
  focusApp: () => void;
  /** 右键 — 弹出原生交互菜单 */
  showContextMenu: () => void;
  /** 监听鼠标悬停状态变化（由主进程轮询驱动） */
  onHoverChange: (callback: (hovered: boolean) => void) => () => void;
  /** 获取当前宠物信息 */
  getCurrentPet: () => Promise<PetMetadata | null>;
  /** 监听宠物切换 */
  onPetChange: (callback: (pet: PetMetadata) => void) => () => void;
  /** 获取动画帧速 */
  getAnimationFps: () => Promise<number>;
  /** 监听动画帧速变化 */
  onAnimationFpsChange: (callback: (fps: number) => void) => () => void;
  /** 获取宠物可见性 */
  isPetVisible: () => Promise<boolean>;
  /** 显示/隐藏宠物 */
  setPetVisible: (visible: boolean) => void;
  /** 监听宠物可见性变化 */
  onVisibilityChange: (callback: (visible: boolean) => void) => () => void;
}

/** 配置窗口 API */
export interface ConfigAPI {
  /** 获取 LLM 配置 */
  getConfig: () => Promise<LLMConfig>;
  /** 保存 LLM 配置 */
  saveConfig: (config: LLMConfig) => Promise<void>;
  /** 获取已安装宠物列表 */
  getPets: () => Promise<PetMetadata[]>;
  /** 切换当前宠物 */
  selectPet: (petId: string) => Promise<void>;
  /** 删除宠物 */
  deletePet: (petId: string) => Promise<void>;
  /** 上传宠物包 */
  uploadPet: (filePath: string, name: string, description: string) => Promise<PetPackage>;
  /** 发送对话消息（返回 SSE 流） */
  chat: (messages: ChatMessage[]) => Promise<Response>;
  /** 获取对话历史 */
  getHistory: () => Promise<ChatMessage[]>;
  /** 清空对话历史 */
  clearHistory: () => Promise<void>;
  /** 通知桌宠切换状态 */
  notifyPetState: (state: AIServiceState, text?: string) => void;
  /** 预览宠物动画 */
  previewPet: (petId: string, state: PetAnimationState) => void;
}

/** 全局 window 扩展 */
declare global {
  interface Window {
    petAPI: PetAPI;
    configAPI: ConfigAPI;
  }
}
