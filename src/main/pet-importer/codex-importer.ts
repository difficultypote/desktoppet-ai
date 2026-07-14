// ============================================================
// codex-importer.ts — Codex 原生包导入
// 直接读取并校验已有的 pet.json 和 spritesheet
// ============================================================

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { PetMetadata } from '../../shared/types';
import { validateSpritesheetSize } from '../../shared/pet-utils';
import type { ImporterResult } from './sprite-builder';

/** 支持的 spritesheet 文件名 */
const SPRITESHEET_NAMES = [
  'spritesheet.png',
  'spritesheet.jpg',
  'spritesheet.jpeg',
];

/**
 * 导入 Codex 原生包
 *
 * 1. 查找并解析 pet.json
 * 2. 校验必填字段
 * 3. 查找并读取 spritesheet 文件
 * 4. 校验 spritesheet 尺寸
 *
 * @param extractedDir 解压后的临时目录
 * @param files 文件相对路径列表
 * @returns 导入结果（包含 metadata 和 spritesheetBuffer）
 */
export async function importCodex(
  extractedDir: string,
  files: string[],
): Promise<ImporterResult> {
  const warnings: string[] = [];
  const normalizedFiles = files.map((f) => f.replace(/\\/g, '/'));

  // 1. 查找 pet.json
  const petJsonFile = normalizedFiles.find((f) =>
    f.toLowerCase().endsWith('pet.json'),
  );
  if (!petJsonFile) {
    throw new Error('Codex 格式缺少 pet.json 文件');
  }

  // 2. 解析 pet.json
  const petJsonPath = path.join(extractedDir, petJsonFile);
  let metadata: PetMetadata;

  try {
    const raw = fs.readFileSync(petJsonPath, 'utf-8');
    metadata = JSON.parse(raw) as PetMetadata;
  } catch (e) {
    throw new Error(`pet.json 解析失败: ${(e as Error).message}`);
  }

  // 3. 校验必填字段
  if (!metadata.id || !metadata.name || !metadata.spritesheet) {
    throw new Error('pet.json 缺少必填字段 (id, name, spritesheet)');
  }

  // 4. 查找 spritesheet 文件
  // 优先使用 metadata 中指定的文件名，其次查找标准名称
  const metadataSprite = metadata.spritesheet.replace(/\\/g, '/');
  let spritesheetFile = normalizedFiles.find(
    (f) => f.toLowerCase() === metadataSprite.toLowerCase(),
  );

  if (!spritesheetFile) {
    // 回退到标准文件名查找
    spritesheetFile = normalizedFiles.find((f) =>
      SPRITESHEET_NAMES.includes(f.toLowerCase()),
    );
  }

  if (!spritesheetFile) {
    throw new Error(
      `找不到 spritesheet 文件: ${metadata.spritesheet}（也未找到标准命名的 spritesheet）`,
    );
  }

  // 5. 读取 spritesheet
  const spritesheetPath = path.join(extractedDir, spritesheetFile);
  const spritesheetBuffer = fs.readFileSync(spritesheetPath);

  // 6. 校验 spritesheet 尺寸
  try {
    const imgMeta = await sharp(spritesheetBuffer).metadata();
    const sizeCheck = validateSpritesheetSize(
      imgMeta.width || 0,
      imgMeta.height || 0,
    );
    if (sizeCheck.warning) {
      warnings.push(sizeCheck.warning);
    }
  } catch (e) {
    warnings.push(`spritesheet 尺寸校验失败: ${(e as Error).message}`);
  }

  // 规范化 spritesheet 字段为标准文件名
  metadata.spritesheet = 'spritesheet.png';

  return {
    metadata,
    spritesheetBuffer,
    warnings,
  };
}
