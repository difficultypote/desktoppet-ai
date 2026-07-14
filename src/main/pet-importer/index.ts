// ============================================================
// index.ts — 宠物包导入器入口
// 解压 zip → 识别格式 → 调用对应导入器 → 打包到 ~/.codex/pets/
// ============================================================

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { PetMetadata, PetPackage, PetFormat } from '../../shared/types';
import { generatePetId } from '../../shared/pet-utils';
import { getPetsDir } from '../pet-loader';
import { detectFormat } from './detector';
import { createPetPackage } from './pet-packager';
import { importCodex } from './codex-importer';
import { importShimeji } from './shimeji-importer';
import { importGif } from './gif-importer';
import { importFrames } from './frames-importer';
import { importSingle } from './single-importer';
import {
  IMAGE_EXTENSIONS,
  type ImporterResult,
} from './sprite-builder';

/**
 * 递归扫描目录，返回所有文件的相对路径列表
 *
 * @param dir 要扫描的目录
 * @param base 相对路径基准（递归使用）
 * @returns 文件相对路径列表
 */
function scanFiles(dir: string, base: string = ''): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = base ? path.join(base, entry.name) : entry.name;

    if (entry.isDirectory()) {
      results.push(...scanFiles(path.join(dir, entry.name), relativePath));
    } else {
      results.push(relativePath);
    }
  }

  return results;
}

/**
 * 导入 Live2D 格式（降级处理）
 *
 * Live2D 转换暂未完全支持，尝试提取静态图片作为 idle 帧占位
 */
async function importLive2D(
  extractedDir: string,
  files: string[],
): Promise<ImporterResult> {
  const warnings: string[] = [
    'Live2D 转换暂未完全支持，仅提取静态图片作为占位',
  ];

  const normalizedFiles = files.map((f) => f.replace(/\\/g, '/'));

  // 查找可用的图片文件（优先 PNG 纹理）
  const imageFile = normalizedFiles.find((f) =>
    IMAGE_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)),
  );

  if (!imageFile) {
    throw new Error('Live2D 包中未找到可用的图片文件，无法生成占位 spritesheet');
  }

  warnings.push(`使用图片 "${imageFile}" 作为静态占位`);

  // 复用单张图片导入器
  const result = await importSingle(extractedDir, [imageFile]);

  return {
    ...result,
    warnings: [...warnings, ...result.warnings],
  };
}

/**
 * 根据格式调用对应的导入器
 *
 * @param format 宠物格式
 * @param extractedDir 解压后的临时目录
 * @param files 文件相对路径列表
 * @returns 导入结果
 */
async function importByFormat(
  format: PetFormat,
  extractedDir: string,
  files: string[],
): Promise<ImporterResult> {
  switch (format) {
    case 'codex':
      return importCodex(extractedDir, files);
    case 'shimeji':
      return importShimeji(extractedDir, files);
    case 'gif':
      return importGif(extractedDir, files);
    case 'frames':
      return importFrames(extractedDir, files);
    case 'single':
      return importSingle(extractedDir, files);
    case 'live2d':
      return importLive2D(extractedDir, files);
    default:
      throw new Error(`不支持的宠物格式: ${format}`);
  }
}

/**
 * 导入宠物包
 *
 * 完整流程：
 * 1. 解压 zip 到临时目录
 * 2. 扫描文件列表
 * 3. 调用 detector 识别格式
 * 4. 调用对应 importer 转换为 Codex 格式
 * 5. 校验并打包到 ~/.codex/pets/<pet-id>/
 * 6. 清理临时目录
 * 7. 返回 PetPackage 结果（包含 warnings）
 *
 * @param zipPath zip 文件路径
 * @param name 宠物名称
 * @param description 宠物描述
 * @returns 导入结果
 * @throws 解压失败、格式无法识别、转换失败等错误
 */
export async function importPetPackage(
  zipPath: string,
  name: string,
  description: string,
): Promise<PetPackage> {
  // 校验 zip 文件存在
  if (!fs.existsSync(zipPath)) {
    throw new Error(`宠物包文件不存在: ${zipPath}`);
  }

  // 1. 创建临时目录
  const tempDir = path.join(
    os.tmpdir(),
    `pet-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // 2. 解压 zip
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipPath);
      zip.extractAllTo(tempDir, true);
    } catch (e) {
      throw new Error(`解压失败: ${(e as Error).message}`);
    }

    // 3. 扫描文件列表
    const files = scanFiles(tempDir);
    if (files.length === 0) {
      throw new Error('宠物包为空，未找到任何文件');
    }

    // 4. 识别格式
    const format = detectFormat(files);
    if (format === 'unknown') {
      throw new Error(
        '无法识别宠物包格式，请确保包中包含 pet.json+spritesheet、.model3.json、conf/actions.xml、.gif 或图片文件',
      );
    }

    // 5. 调用对应导入器
    let importResult: ImporterResult;
    try {
      importResult = await importByFormat(format, tempDir, files);
    } catch (e) {
      throw new Error(
        `${format} 格式转换失败: ${(e as Error).message}`,
      );
    }

    // 6. 构建元数据
    // 用户提供的 name 和 description 优先，导入器的额外元数据作为补充
    const petId = importResult.metadata?.id || generatePetId(name);
    const metadata: PetMetadata = {
      id: petId,
      name,
      description: description || importResult.metadata?.description,
      spritesheet: 'spritesheet.png',
      version: importResult.metadata?.version || '1.0.0',
      ...(importResult.metadata?.author
        ? { author: importResult.metadata.author }
        : {}),
      ...(importResult.metadata?.tags
        ? { tags: importResult.metadata.tags }
        : {}),
    };

    // 7. 打包到 ~/.codex/pets/<pet-id>/
    const petsDir = getPetsDir();
    const petPackage = await createPetPackage(
      metadata,
      importResult.spritesheetBuffer,
      petsDir,
    );

    // 合并导入器的警告
    petPackage.warnings.push(...importResult.warnings);

    return petPackage;
  } finally {
    // 8. 清理临时目录
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // 清理失败不影响主流程
    }
  }
}

// 导出子模块供外部使用
export { detectFormat } from './detector';
export { buildSpritesheet, fillMissingFrames } from './sprite-builder';
export { createPetPackage } from './pet-packager';
export { importCodex } from './codex-importer';
export { importShimeji } from './shimeji-importer';
export { importGif } from './gif-importer';
export { importFrames } from './frames-importer';
export { importSingle } from './single-importer';
export type { FrameInfo, ImporterResult } from './sprite-builder';
