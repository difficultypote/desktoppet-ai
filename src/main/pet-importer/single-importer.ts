// ============================================================
// single-importer.ts — 单张图片扩展
// 将单张图片复制到所有 72 个帧位置，生成静态 spritesheet
// ============================================================

import fs from 'fs';
import path from 'path';
import {
  buildSpritesheet,
  fillMissingFrames,
  IMAGE_EXTENSIONS,
  type FrameInfo,
  type ImporterResult,
} from './sprite-builder';

/**
 * 导入单张图片
 *
 * 1. 查找包中的图片文件
 * 2. 将该图片放置到 (0, 0) 位置
 * 3. 通过 fillMissingFrames 自动复制到所有 72 个帧位置
 * 4. 生成静态 spritesheet
 *
 * @param extractedDir 解压后的临时目录
 * @param files 文件相对路径列表
 * @returns 导入结果
 */
export async function importSingle(
  extractedDir: string,
  files: string[],
): Promise<ImporterResult> {
  const warnings: string[] = [];
  const normalizedFiles = files.map((f) => f.replace(/\\/g, '/'));

  // 查找第一张图片
  const imageFile = normalizedFiles.find((f) =>
    IMAGE_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)),
  );

  if (!imageFile) {
    throw new Error('未找到图片文件');
  }

  // 读取图片
  const imgPath = path.join(extractedDir, imageFile);
  const buffer = fs.readFileSync(imgPath);

  // 创建单帧并填充所有 72 个位置
  const frames: FrameInfo[] = [{ buffer, row: 0, col: 0 }];
  const completeFrames = fillMissingFrames(frames);

  // 拼合 spritesheet
  const spritesheetBuffer = await buildSpritesheet(completeFrames);

  warnings.push('单张图片已复制到所有 72 个帧位置，生成静态 spritesheet');

  return {
    spritesheetBuffer,
    warnings,
  };
}
