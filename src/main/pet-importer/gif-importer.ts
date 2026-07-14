// ============================================================
// gif-importer.ts — GIF 动画拆帧
// 使用 sharp 拆解 GIF 帧，按帧数分配到 9 行（每行 8 帧）
// 不足的行用最后一帧填充
// ============================================================

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { SPRITE_COLS, SPRITE_ROWS } from '../../shared/constants';
import {
  buildSpritesheet,
  fillMissingFrames,
  type FrameInfo,
  type ImporterResult,
} from './sprite-builder';

/**
 * 导入 GIF 动画
 *
 * 1. 使用 sharp 读取 GIF 的帧数信息
 * 2. 逐帧提取并转为 PNG Buffer
 * 3. 按帧数分配到 9 行（每行 8 帧）
 * 4. 不足的行用最后一帧填充
 * 5. 拼合为 spritesheet
 *
 * @param extractedDir 解压后的临时目录
 * @param files 文件相对路径列表
 * @returns 导入结果
 */
export async function importGif(
  extractedDir: string,
  files: string[],
): Promise<ImporterResult> {
  const warnings: string[] = [];
  const normalizedFiles = files.map((f) => f.replace(/\\/g, '/'));

  // 查找 GIF 文件
  const gifFile = normalizedFiles.find((f) =>
    f.toLowerCase().endsWith('.gif'),
  );
  if (!gifFile) {
    throw new Error('未找到 GIF 文件');
  }

  const gifPath = path.join(extractedDir, gifFile);
  const gifBuffer = fs.readFileSync(gifPath);

  // 读取 GIF 元数据获取帧数
  let pageCount = 1;
  try {
    const metadata = await sharp(gifBuffer, { animated: true }).metadata();
    pageCount = metadata.pages || 1;
  } catch (e) {
    throw new Error(`GIF 元数据读取失败: ${(e as Error).message}`);
  }

  if (pageCount === 0) {
    throw new Error('GIF 文件不包含任何帧');
  }

  warnings.push(`GIF 共 ${pageCount} 帧`);

  // 提取每一帧
  const frames: FrameInfo[] = [];
  const maxFrames = SPRITE_ROWS * SPRITE_COLS; // 72
  const frameCount = Math.min(pageCount, maxFrames);

  for (let i = 0; i < frameCount; i++) {
    try {
      const frameBuffer = await sharp(gifBuffer, { page: i })
        .png()
        .toBuffer();

      const row = Math.floor(i / SPRITE_COLS);
      const col = i % SPRITE_COLS;
      frames.push({ buffer: frameBuffer, row, col });
    } catch (e) {
      warnings.push(`第 ${i + 1} 帧提取失败: ${(e as Error).message}`);
    }
  }

  if (frames.length === 0) {
    throw new Error('GIF 帧提取全部失败，无法生成 spritesheet');
  }

  // 如果 GIF 帧数超过 72，截断并警告
  if (pageCount > maxFrames) {
    warnings.push(
      `GIF 有 ${pageCount} 帧，仅使用前 ${maxFrames} 帧生成 spritesheet`,
    );
  }

  // 填充缺失的帧
  const completeFrames = fillMissingFrames(frames);

  // 拼合 spritesheet
  const spritesheetBuffer = await buildSpritesheet(completeFrames);

  return {
    spritesheetBuffer,
    warnings,
  };
}
