// ============================================================
// pet-packager.ts — pet.json 生成与打包
// 将元数据和 spritesheet 写入目标目录，校验并确保唯一性
// ============================================================

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { PetMetadata, PetPackage } from '../../shared/types';
import {
  validateSpritesheetSize,
  ensureUniqueId,
} from '../../shared/pet-utils';
import { listPets } from '../pet-loader';

/** spritesheet 文件名 */
const SPRITESHEET_FILENAME = 'spritesheet.png';

/**
 * 校验 PetMetadata 必填字段
 * @returns 错误消息列表（空数组表示通过）
 */
function validateMetadata(metadata: PetMetadata): string[] {
  const errors: string[] = [];
  if (!metadata.id) errors.push('缺少必填字段: id');
  if (!metadata.name) errors.push('缺少必填字段: name');
  if (!metadata.spritesheet) errors.push('缺少必填字段: spritesheet');
  return errors;
}

/**
 * 创建宠物包
 *
 * 1. 校验必填字段
 * 2. 校验 spritesheet 尺寸（仅警告不拒绝）
 * 3. 确保 id 唯一（如有冲突追加后缀）
 * 4. 写入 pet.json 和 spritesheet.png 到目标目录
 *
 * @param metadata 宠物元数据
 * @param spritesheetBuffer spritesheet PNG Buffer
 * @param outputDir 输出根目录（如 ~/.codex/pets/）
 * @returns PetPackage 结果
 */
export async function createPetPackage(
  metadata: PetMetadata,
  spritesheetBuffer: Buffer,
  outputDir: string,
): Promise<PetPackage> {
  const warnings: string[] = [];

  // 1. 校验必填字段
  const errors = validateMetadata(metadata);
  if (errors.length > 0) {
    throw new Error(`元数据校验失败: ${errors.join('; ')}`);
  }

  // 2. 校验 spritesheet 尺寸
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

  // 3. 确保 id 唯一
  const existingPets = listPets();
  const existingIds = existingPets.map((p) => p.id);
  const uniqueId = ensureUniqueId(metadata.id, existingIds);

  if (uniqueId !== metadata.id) {
    warnings.push(`ID "${metadata.id}" 已存在，自动改为 "${uniqueId}"`);
    metadata.id = uniqueId;
  }

  // 4. 确保输出目录存在
  const petDir = path.join(outputDir, metadata.id);
  if (!fs.existsSync(petDir)) {
    fs.mkdirSync(petDir, { recursive: true });
  }

  // 写入 spritesheet.png
  const spritesheetPath = path.join(petDir, SPRITESHEET_FILENAME);
  fs.writeFileSync(spritesheetPath, spritesheetBuffer);

  // 更新 metadata 中的 spritesheet 字段
  metadata.spritesheet = SPRITESHEET_FILENAME;

  // 写入 pet.json
  const petJsonPath = path.join(petDir, 'pet.json');
  fs.writeFileSync(
    petJsonPath,
    JSON.stringify(metadata, null, 2),
    'utf-8',
  );

  return {
    metadata,
    spritesheetPath,
    warnings,
  };
}
