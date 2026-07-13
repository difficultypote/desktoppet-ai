// ============================================================
// pet-loader.ts — 宠物包加载与解析
// 扫描 ~/.codex/pets/ 目录，加载宠物元数据
// ============================================================

import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import type { PetMetadata } from '../renderer/shared/types';
import { CODEX_PETS_DIR } from '../renderer/shared/constants';

/** 获取 Codex 宠物目录的完整路径 */
export function getPetsDir(): string {
  return path.join(os.homedir(), CODEX_PETS_DIR);
}

/** 获取配置目录的完整路径（使用 Electron userData 目录，确保可写） */
export function getConfigDir(): string {
  // app.getPath('userData') 在 index.ts 中被设置为项目内 .electron-data
  return app.getPath('userData');
}

/**
 * 扫描所有已安装的宠物包
 * 返回 pet.json 解析后的元数据列表
 */
export function listPets(): PetMetadata[] {
  const petsDir = getPetsDir();
  const pets: PetMetadata[] = [];

  if (!fs.existsSync(petsDir)) {
    return pets;
  }

  const entries = fs.readdirSync(petsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const petJsonPath = path.join(petsDir, entry.name, 'pet.json');
    if (!fs.existsSync(petJsonPath)) continue;

    try {
      const raw = fs.readFileSync(petJsonPath, 'utf-8');
      const metadata = JSON.parse(raw) as PetMetadata;

      // 校验必填字段
      if (!metadata.id || !metadata.name || !metadata.spritesheet) {
        continue;
      }

      // 校验 spritesheet 文件存在
      const spritePath = path.join(petsDir, entry.name, metadata.spritesheet);
      if (!fs.existsSync(spritePath)) {
        continue;
      }

      pets.push(metadata);
    } catch {
      // 跳过解析失败的宠物包
      continue;
    }
  }

  return pets;
}

/**
 * 获取指定宠物的 spritesheet 完整路径
 */
export function getPetSpritesheetPath(petId: string): string | null {
  const petsDir = getPetsDir();
  const petDir = path.join(petsDir, petId);
  const petJsonPath = path.join(petDir, 'pet.json');

  if (!fs.existsSync(petJsonPath)) return null;

  try {
    const metadata = JSON.parse(fs.readFileSync(petJsonPath, 'utf-8'));
    const spritePath = path.join(petDir, metadata.spritesheet);
    if (fs.existsSync(spritePath)) {
      return spritePath;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * 获取指定宠物的元数据
 */
export function getPetMetadata(petId: string): PetMetadata | null {
  const petsDir = getPetsDir();
  const petJsonPath = path.join(petsDir, petId, 'pet.json');

  if (!fs.existsSync(petJsonPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(petJsonPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 删除指定宠物包
 */
export function deletePet(petId: string): void {
  const petsDir = getPetsDir();
  const petDir = path.join(petsDir, petId);

  if (fs.existsSync(petDir)) {
    fs.rmSync(petDir, { recursive: true, force: true });
  }
}

/**
 * 获取当前选中的宠物 ID
 * 存储在 ~/.desktoppet/current-pet.txt
 */
export function getCurrentPetId(): string | null {
  const currentPetFile = path.join(getConfigDir(), 'current-pet.txt');
  if (!fs.existsSync(currentPetFile)) return null;

  try {
    const id = fs.readFileSync(currentPetFile, 'utf-8').trim();
    return id || null;
  } catch {
    return null;
  }
}

/**
 * 设置当前选中的宠物
 */
export function setCurrentPetId(petId: string): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(path.join(configDir, 'current-pet.txt'), petId, 'utf-8');
}

/**
 * 获取当前宠物（优先从配置读取，否则返回第一个）
 */
export function getCurrentPet(): PetMetadata | null {
  const pets = listPets();
  if (pets.length === 0) return null;

  const currentId = getCurrentPetId();
  if (currentId) {
    const found = pets.find((p) => p.id === currentId);
    if (found) return found;
  }

  // 默认返回第一个
  return pets[0];
}

/**
 * 确保默认宠物存在
 * 如果没有任何宠物包，创建一个内置的默认宠物
 */
export function ensureDefaultPet(): void {
  const pets = listPets();
  if (pets.length > 0) return;

  // 创建默认宠物目录
  const defaultPetDir = path.join(getPetsDir(), 'default');
  if (!fs.existsSync(defaultPetDir)) {
    fs.mkdirSync(defaultPetDir, { recursive: true });
  }

  // 写入默认 pet.json
  const defaultMetadata: PetMetadata = {
    id: 'default',
    name: '小助手',
    description: '默认桌面宠物',
    spritesheet: 'spritesheet.png',
    version: '1.0.0',
    author: 'DesktopPet AI',
    tags: ['default'],
  };

  fs.writeFileSync(
    path.join(defaultPetDir, 'pet.json'),
    JSON.stringify(defaultMetadata, null, 2),
    'utf-8',
  );

  // 尝试从 resources/default-pets 复制默认 spritesheet
  // 开发模式：process.cwd() 指向项目根目录
  // 生产模式：__dirname 指向打包后的目录
  const builtinSpritePath = process.env.NODE_ENV === 'development'
    ? path.join(process.cwd(), 'resources', 'default-pets', 'spritesheet.png')
    : path.join(__dirname, '..', 'resources', 'default-pets', 'spritesheet.png');
  const targetSpritePath = path.join(defaultPetDir, 'spritesheet.png');

  if (fs.existsSync(builtinSpritePath) && !fs.existsSync(targetSpritePath)) {
    fs.copyFileSync(builtinSpritePath, targetSpritePath);
  } else if (!fs.existsSync(targetSpritePath)) {
    // 如果没有内置 spritesheet，生成一个纯色占位图
    generatePlaceholderSpritesheet(targetSpritePath);
  }
}

/**
 * 生成占位 spritesheet（纯色透明背景，带简单图形）
 */
function generatePlaceholderSpritesheet(targetPath: string): void {
  // 使用 Canvas 生成占位图（在主进程中无法直接用 Canvas，这里创建一个最小的 PNG）
  // 实际应用中应该有内置的 spritesheet 文件
  // 这里写一个 1x1 透明像素的 PNG 作为最小占位
  const minimalPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  fs.writeFileSync(targetPath, minimalPng);
}
