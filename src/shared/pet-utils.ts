import type { PetAnimationState } from './types';
import {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  SPRITE_COLS,
  STATE_ROW_MAP,
} from './constants';

/**
 * 计算指定状态和帧索引在 spritesheet 中的源坐标
 */
export function getSpriteSourceRect(
  state: PetAnimationState,
  frameIndex: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const row = STATE_ROW_MAP[state];
  const col = frameIndex % SPRITE_COLS;
  return {
    sx: col * FRAME_WIDTH,
    sy: row * FRAME_HEIGHT,
    sw: FRAME_WIDTH,
    sh: FRAME_HEIGHT,
  };
}

/**
 * 从文件名或字符串生成合法的 pet id
 * 只保留英文字母、数字和短横线，转为小写
 */
export function generatePetId(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'unnamed-pet';
}

/**
 * 确保 id 唯一：如果已存在则追加后缀
 */
export function ensureUniqueId(id: string, existingIds: string[]): string {
  if (!existingIds.includes(id)) return id;
  let suffix = 2;
  while (existingIds.includes(`${id}-${suffix}`)) {
    suffix++;
  }
  return `${id}-${suffix}`;
}

/**
 * 校验 spritesheet 图片尺寸
 * 允许 ±2px 容差
 */
export function validateSpritesheetSize(
  width: number,
  height: number,
): { valid: boolean; warning?: string } {
  const expectedWidth = SPRITE_COLS * FRAME_WIDTH; // 1536
  const expectedHeight = 9 * FRAME_HEIGHT; // 1872
  const tolerance = 2;

  if (
    Math.abs(width - expectedWidth) > tolerance ||
    Math.abs(height - expectedHeight) > tolerance
  ) {
    return {
      valid: true, // 尺寸不匹配只警告不拒绝
      warning: `图集尺寸 ${width}x${height} 不符合标准 ${expectedWidth}x${expectedHeight}，可能导致动画错位`,
    };
  }

  return { valid: true };
}
