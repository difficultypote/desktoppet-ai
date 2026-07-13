// ============================================================
// frames-importer.ts — 散装帧图片拼合
// 按文件名排序所有图片，每 8 张拼一行
// 不足的行用最后一帧填充
// ============================================================

import fs from 'fs';
import path from 'path';
import { SPRITE_COLS, SPRITE_ROWS } from '../../renderer/shared/constants';
import {
  buildSpritesheet,
  fillMissingFrames,
  IMAGE_EXTENSIONS,
  type FrameInfo,
  type ImporterResult,
} from './sprite-builder';

/**
 * 导入散装帧图片
 *
 * 1. 按文件名排序所有图片
 * 2. 每 8 张拼一行，最多 9 行（72 帧）
 * 3. 不足的行用最后一帧填充
 * 4. 缩放并拼合为 spritesheet
 *
 * @param extractedDir 解压后的临时目录
 * @param files 文件相对路径列表
 * @returns 导入结果
 */
export async function importFrames(
  extractedDir: string,
  files: string[],
): Promise<ImporterResult> {
  const warnings: string[] = [];
  const normalizedFiles = files.map((f) => f.replace(/\\/g, '/'));

  // 收集并排序所有图片文件
  const imageFiles = normalizedFiles
    .filter((f) =>
      IMAGE_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)),
    )
    .sort();

  if (imageFiles.length === 0) {
    throw new Error('未找到任何图片文件');
  }

  const maxFrames = SPRITE_ROWS * SPRITE_COLS; // 72
  const frameCount = Math.min(imageFiles.length, maxFrames);

  if (imageFiles.length > maxFrames) {
    warnings.push(
      `共有 ${imageFiles.length} 张图片，仅使用前 ${maxFrames} 张生成 spritesheet`,
    );
  }

  // 按文件名排序分配到网格
  const frames: FrameInfo[] = [];
  for (let i = 0; i < frameCount; i++) {
    const row = Math.floor(i / SPRITE_COLS);
    const col = i % SPRITE_COLS;
    const imgPath = path.join(extractedDir, imageFiles[i]);
    const buffer = fs.readFileSync(imgPath);
    frames.push({ buffer, row, col });
  }

  // 填充缺失的帧
  const completeFrames = fillMissingFrames(frames);

  // 拼合 spritesheet
  const spritesheetBuffer = await buildSpritesheet(completeFrames);

  warnings.push(`已从 ${frameCount} 张图片生成 spritesheet`);

  return {
    spritesheetBuffer,
    warnings,
  };
}
