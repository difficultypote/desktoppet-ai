// ============================================================
// detector.ts — 宠物格式识别器
// 根据文件列表判断宠物包的格式类型
// 优先级：codex > live2d > shimeji > gif > single > frames > unknown
// ============================================================

import type { PetFormat } from '../../renderer/shared/types';

/** 支持的图片扩展名 */
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.bmp', '.webp'];

/**
 * 将文件路径归一化为小写正斜杠形式，便于匹配
 */
function normalize(filePath: string): string {
  return filePath.toLowerCase().replace(/\\/g, '/');
}

/**
 * 检测文件列表对应的宠物格式
 *
 * 按优先级判断：
 * 1. codex   — 同时存在 pet.json 和 spritesheet 图片
 * 2. live2d  — 存在 .model3.json 或 .moc3 文件
 * 3. shimeji — 存在 conf/ 目录或 .xml 配置文件
 * 4. gif     — 存在 .gif 动画文件
 * 5. single  — 仅有一张图片
 * 6. frames  — 有多张散装图片
 * 7. unknown — 无法识别
 *
 * @param files 文件相对路径列表
 * @returns 识别出的宠物格式
 */
export function detectFormat(files: string[]): PetFormat {
  const normalized = files.map(normalize);

  // 1. codex: 有 pet.json + spritesheet 图片
  const hasPetJson = normalized.some((f) => f.endsWith('pet.json'));
  const hasSpritesheet = normalized.some(
    (f) =>
      f.endsWith('spritesheet.png') ||
      f.endsWith('spritesheet.jpg') ||
      f.endsWith('spritesheet.jpeg'),
  );
  if (hasPetJson && hasSpritesheet) {
    return 'codex';
  }

  // 2. live2d: 有 .model3.json 或 .moc3
  const hasModel3 = normalized.some((f) => f.endsWith('.model3.json'));
  const hasMoc3 = normalized.some((f) => f.endsWith('.moc3'));
  if (hasModel3 || hasMoc3) {
    return 'live2d';
  }

  // 3. shimeji: 有 conf/ 目录或 .xml 文件
  const hasConfDir = normalized.some((f) => f.includes('/conf/'));
  const hasXml = normalized.some((f) => f.endsWith('.xml'));
  if (hasConfDir || hasXml) {
    return 'shimeji';
  }

  // 4. gif: 有 .gif 文件
  const hasGif = normalized.some((f) => f.endsWith('.gif'));
  if (hasGif) {
    return 'gif';
  }

  // 5 & 6. 统计图片文件数量
  const imageFiles = normalized.filter((f) =>
    IMAGE_EXTENSIONS.some((ext) => f.endsWith(ext)),
  );

  if (imageFiles.length === 1) {
    return 'single';
  }

  if (imageFiles.length > 1) {
    return 'frames';
  }

  // 7. 无法识别
  return 'unknown';
}
