import type { PetAnimationState, AIServiceState } from './types';

// ============================================================
// Spritesheet 常量
// ============================================================

/** 整体图集宽度 */
export const SPRITE_SHEET_WIDTH = 1536;
/** 整体图集高度 */
export const SPRITE_SHEET_HEIGHT = 1872;
/** 每行帧数（列数） */
export const SPRITE_COLS = 8;
/** 总行数（状态数） */
export const SPRITE_ROWS = 9;
/** 单帧宽度 */
export const FRAME_WIDTH = 192;
/** 单帧高度 */
export const FRAME_HEIGHT = 208;
/** 总帧数 */
export const TOTAL_FRAMES = SPRITE_COLS * SPRITE_ROWS; // 72

// ============================================================
// 动画常量
// ============================================================

/** 默认帧率（1-10 范围，默认 6） */
export const DEFAULT_FPS = 6;
/** 空闲随机动画间隔（毫秒） */
export const IDLE_RANDOM_INTERVAL = 15000;
/** 欢呼动画持续时间（毫秒） */
export const WAVING_DURATION = 3000;
/** 失败动画持续时间（毫秒） */
export const FAILED_DURATION = 5000;

/**
 * 每个状态行的有效帧数（非透明帧）
 * 超出此帧数的帧是空白透明帧，循环时不应播放
 * 如果值为 0 或未定义，则使用 SPRITE_COLS（8帧）
 */
export const STATE_FRAME_COUNTS: Record<PetAnimationState, number> = {
  idle: 6,              // 后2帧空白
  'running-right': 8,   // 全部有内容
  'running-left': 8,    // 全部有内容
  waving: 4,            // 后4帧空白
  jumping: 5,           // 后3帧空白
  failed: 8,            // 全部有内容
  waiting: 6,           // 后2帧空白
  running: 6,           // 后2帧空白
  review: 6,            // 后2帧空白
};

// ============================================================
// 状态映射
// ============================================================

/** 动画状态 → spritesheet 行号 */
export const STATE_ROW_MAP: Record<PetAnimationState, number> = {
  idle: 0,
  'running-right': 1,
  'running-left': 2,
  waving: 3,
  jumping: 4,
  failed: 5,
  waiting: 6,
  running: 7,
  review: 8,
};

/** AI 服务状态 → 桌宠动画状态 */
export const STATE_MAP: Record<AIServiceState, PetAnimationState> = {
  idle: 'idle',
  thinking: 'review',
  generating: 'running',
  'waiting-input': 'waiting',
  error: 'failed',
  done: 'waving',
};

/** 所有宠物动画状态列表 */
export const ALL_PET_STATES: PetAnimationState[] = [
  'idle',
  'running-right',
  'running-left',
  'waving',
  'jumping',
  'failed',
  'waiting',
  'running',
  'review',
];

/** 动画状态中文标签 */
export const STATE_LABELS: Record<PetAnimationState, string> = {
  idle: '空闲',
  'running-right': '向右移动',
  'running-left': '向左移动',
  waving: '欢呼',
  jumping: '跳跃',
  failed: '失败',
  waiting: '等待',
  running: '运行中',
  review: '思考',
};

/** 各状态下方的状态文本 */
export const STATE_TEXT_MAP: Record<PetAnimationState, string> = {
  idle: '',
  'running-right': '',
  'running-left': '',
  waving: '完成！点击查看结果',
  jumping: '',
  failed: '出错了',
  waiting: '正在休息~ Zzz',
  running: '正在处理…',
  review: '正在思考…',
};

// ============================================================
// 路径与端口
// ============================================================

/** 内嵌 HTTP 服务器端口 */
export const HTTP_SERVER_PORT = 31750;

/** Codex 宠物目录 */
export const CODEX_PETS_DIR = '.codex/pets';

/** DesktopPet 配置目录 */
export const DESKTOPPET_CONFIG_DIR = '.desktoppet';

/** 配置文件名 */
export const CONFIG_FILENAME = 'config.json';

/** 历史记录文件名 */
export const HISTORY_FILENAME = 'history.json';

// ============================================================
// 默认 LLM 配置
// ============================================================

export const DEFAULT_LLM_CONFIG = {
  configVersion: 4, // v4: FPS 1-10 范围 + UI 美化
  apiEndpoint: 'https://api-inference.modelscope.cn/v1',
  apiKey: 'ms-55454bd1-67f6-4377-8a55-fc06e966dec8',
  model: 'Qwen/Qwen3.5-397B-A17B',
  systemPrompt: '你是一个友好的桌面宠物助手，请用简洁可爱的语气回答问题。',
  temperature: 0.7,
  maxTokens: 2048,
  animationFps: 6,
};
