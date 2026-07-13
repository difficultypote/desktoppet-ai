// ============================================================
// sprite-builder.ts — Spritesheet 拼合工具
// 使用 sharp 库将多个帧图片拼合到标准画布上
// ============================================================

import sharp from 'sharp';
import type { PetMetadata } from '../../renderer/shared/types';
import {
  SPRITE_SHEET_WIDTH,
  SPRITE_SHEET_HEIGHT,
  FRAME_WIDTH,
  FRAME_HEIGHT,
  SPRITE_COLS,
  SPRITE_ROWS,
} from '../../renderer/shared/constants';

/** 支持的图片扩展名 */
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.bmp', '.webp'];

/** 单帧信息：包含图片缓冲区和在画布中的位置 */
export interface FrameInfo {
  buffer: Buffer;
  row: number;
  col: number;
}

/** 导入器统一返回类型 */
export interface ImporterResult {
  spritesheetBuffer: Buffer;
  warnings: string[];
  /** 导入器可能提供的额外元数据（author, version, tags 等） */
  metadata?: Partial<PetMetadata>;
}

/**
 * 将多个帧图片拼合到 1536x1872 的画布上
 *
 * - 每帧缩放到 192x208（contain 模式，保持比例）
 * - 输出为 PNG 格式的 Buffer
 * - 超出画布范围的帧会被跳过
 *
 * @param frames 帧信息数组
 * @returns PNG 格式的 spritesheet Buffer
 */
export async function buildSpritesheet(frames: FrameInfo[]): Promise<Buffer> {
  const composites: sharp.OverlayOptions[] = [];

  for (const frame of frames) {
    // 校验行列范围
    if (frame.row < 0 || frame.row >= SPRITE_ROWS) continue;
    if (frame.col < 0 || frame.col >= SPRITE_COLS) continue;

    // 缩放帧到目标尺寸
    const resized = await sharp(frame.buffer)
      .resize(FRAME_WIDTH, FRAME_HEIGHT, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const left = frame.col * FRAME_WIDTH;
    const top = frame.row * FRAME_HEIGHT;

    composites.push({ input: resized, left, top });
  }

  // 创建透明背景画布并合成所有帧
  const spritesheet = await sharp({
    create: {
      width: SPRITE_SHEET_WIDTH,
      height: SPRITE_SHEET_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return spritesheet;
}

/**
 * 填充缺失的帧位置，确保 72 个位置全部有内容
 *
 * 策略：
 * - 同一行中缺失的位置用该行最后一个有效帧填充
 * - 如果整行为空，用全局最后一个有效帧填充
 *
 * @param frames 已有的帧列表（可能不完整）
 * @returns 完整的 72 帧列表
 */
export function fillMissingFrames(frames: FrameInfo[]): FrameInfo[] {
  // 创建 9x8 网格
  const grid: (FrameInfo | null)[][] = Array.from({ length: SPRITE_ROWS }, () =>
    Array.from({ length: SPRITE_COLS }, () => null),
  );

  // 填入已有帧
  for (const frame of frames) {
    if (
      frame.row >= 0 &&
      frame.row < SPRITE_ROWS &&
      frame.col >= 0 &&
      frame.col < SPRITE_COLS
    ) {
      grid[frame.row][frame.col] = frame;
    }
  }

  // 查找全局最后一个有效帧
  let lastFrame: FrameInfo | null = null;
  for (let row = 0; row < SPRITE_ROWS; row++) {
    for (let col = 0; col < SPRITE_COLS; col++) {
      if (grid[row][col]) {
        lastFrame = grid[row][col];
      }
    }
  }

  if (!lastFrame) {
    throw new Error('没有可用的帧来填充 spritesheet，请检查图片文件是否有效');
  }

  // 填充缺失位置
  const result: FrameInfo[] = [];
  for (let row = 0; row < SPRITE_ROWS; row++) {
    let rowLastFrame: FrameInfo | null = null;
    for (let col = 0; col < SPRITE_COLS; col++) {
      if (grid[row][col]) {
        rowLastFrame = grid[row][col];
        result.push(grid[row][col]!);
      } else {
        // 优先用本行最后一帧，其次用全局最后一帧
        const fillFrame = rowLastFrame || lastFrame;
        result.push({
          buffer: fillFrame.buffer,
          row,
          col,
        });
      }
    }
  }

  return result;
}
