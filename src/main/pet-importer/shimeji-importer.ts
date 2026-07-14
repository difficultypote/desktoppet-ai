// ============================================================
// shimeji-importer.ts — Shimeji 格式转换
// 解析 conf/actions.xml 中的动作名，映射到 9 种 Codex 状态
// 从 img/ 提取对应帧图片，缩放并拼合为 spritesheet
// ============================================================

import fs from 'fs';
import path from 'path';
import type { PetAnimationState } from '../../shared/types';
import {
  SPRITE_COLS,
  SPRITE_ROWS,
  STATE_ROW_MAP,
} from '../../shared/constants';
import {
  buildSpritesheet,
  fillMissingFrames,
  IMAGE_EXTENSIONS,
  type FrameInfo,
  type ImporterResult,
} from './sprite-builder';

/**
 * Shimeji 动作名（小写）→ Codex 动画状态映射
 * 多个 Shimeji 动作可映射到同一个 Codex 状态
 */
const SHIMEJI_ACTION_MAP: Record<string, PetAnimationState> = {
  // idle 行
  stand: 'idle',
  standing: 'idle',
  breathe: 'idle',
  // running-right 行
  walkright: 'running-right',
  walkingright: 'running-right',
  slidedownright: 'running-right',
  // running-left 行
  walkleft: 'running-left',
  walkingleft: 'running-left',
  slidedownleft: 'running-left',
  // waving 行
  wave: 'waving',
  waved: 'waving',
  waving: 'waving',
  // jumping 行
  jump: 'jumping',
  jumping: 'jumping',
  bounce: 'jumping',
  // failed 行
  fall: 'failed',
  falling: 'failed',
  fallen: 'failed',
  fail: 'failed',
  drag: 'failed',
  dragged: 'failed',
  // waiting 行
  sit: 'waiting',
  sitting: 'waiting',
  wait: 'waiting',
  waiting: 'waiting',
  sleep: 'waiting',
  // running 行
  run: 'running',
  running: 'running',
  chase: 'running',
  chasemouse: 'running',
  dash: 'running',
  // review 行
  think: 'review',
  thinking: 'review',
  review: 'review',
  wonder: 'review',
};

/**
 * 解析 Shimeji XML 中的动作名
 * 使用正则匹配 <Action Name="..."> 或 <action name="...">
 *
 * @param xmlContent XML 文件内容
 * @returns 动作名列表
 */
function parseActionNames(xmlContent: string): string[] {
  const actionNames: string[] = [];

  // 匹配 <Action Name="..."> 或 <action name="...">
  const regex = /<action\s+[^>]*?(?:name|Name)\s*=\s*["']([^"']+)["'][^>]*?>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xmlContent)) !== null) {
    actionNames.push(match[1]);
  }

  return actionNames;
}

/**
 * 根据动作名在图片文件列表中查找匹配的图片
 * 匹配规则：文件名（不含扩展名）包含动作名（不区分大小写）
 *
 * @param imageFiles 图片文件路径列表
 * @param actionName 动作名
 * @returns 匹配的图片文件路径列表
 */
function findActionImages(
  imageFiles: string[],
  actionName: string,
): string[] {
  const lowerAction = actionName.toLowerCase();
  return imageFiles.filter((f) => {
    const basename = path.basename(f, path.extname(f)).toLowerCase();
    return basename.includes(lowerAction);
  });
}

/**
 * 导入 Shimeji 格式
 *
 * 1. 尝试解析 conf/actions.xml 中的动作名
 * 2. 将动作名映射到 9 种 Codex 状态
 * 3. 从 img/ 提取对应帧图片
 * 4. 缩放到 192x208 并拼合为 spritesheet
 * 5. 如果 XML 解析失败，按文件名排序提取图片
 *
 * @param extractedDir 解压后的临时目录
 * @param files 文件相对路径列表
 * @returns 导入结果
 */
export async function importShimeji(
  extractedDir: string,
  files: string[],
): Promise<ImporterResult> {
  const warnings: string[] = [];
  const normalizedFiles = files.map((f) => f.replace(/\\/g, '/'));

  // 收集所有图片文件并排序
  const imageFiles = normalizedFiles
    .filter((f) =>
      IMAGE_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)),
    )
    .sort();

  if (imageFiles.length === 0) {
    throw new Error('Shimeji 包中未找到任何图片文件');
  }

  // 查找 XML 配置文件
  const xmlFile =
    normalizedFiles.find(
      (f) => f.toLowerCase().includes('conf/') && f.toLowerCase().endsWith('.xml'),
    ) || normalizedFiles.find((f) => f.toLowerCase().endsWith('.xml'));

  const frames: FrameInfo[] = [];

  if (xmlFile) {
    try {
      const xmlPath = path.join(extractedDir, xmlFile);
      const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
      const actionNames = parseActionNames(xmlContent);

      if (actionNames.length === 0) {
        warnings.push('XML 中未找到动作定义，按文件名排序提取图片');
      } else {
        // 记录已映射的状态，避免重复
        const mappedStates = new Set<PetAnimationState>();

        for (const actionName of actionNames) {
          const state = SHIMEJI_ACTION_MAP[actionName.toLowerCase()];

          // 如果该状态已被映射，跳过
          if (!state || mappedStates.has(state)) continue;

          // 查找与此动作相关的图片
          const actionImages = findActionImages(imageFiles, actionName);

          if (actionImages.length > 0) {
            mappedStates.add(state);
            const row = STATE_ROW_MAP[state];

            // 每行最多 8 帧
            for (
              let col = 0;
              col < Math.min(actionImages.length, SPRITE_COLS);
              col++
            ) {
              const imgPath = path.join(extractedDir, actionImages[col]);
              const buffer = fs.readFileSync(imgPath);
              frames.push({ buffer, row, col });
            }
          }
        }

        if (frames.length === 0) {
          warnings.push(
            '未能从 XML 动作映射中提取到任何帧图片，按文件名排序提取图片',
          );
        } else {
          // 检查未映射的状态
          const allStates = Object.values(STATE_ROW_MAP);
          const unmappedCount = allStates.filter(
            (row) => !frames.some((f) => f.row === row),
          ).length;

          if (unmappedCount > 0) {
            warnings.push(
              `有 ${unmappedCount} 个状态未找到对应动作图片，将用已有帧填充`,
            );
          }
        }
      }
    } catch (e) {
      warnings.push(
        `XML 解析失败: ${(e as Error).message}，按文件名排序提取图片`,
      );
    }
  } else {
    warnings.push('未找到 XML 配置文件，按文件名排序提取图片');
  }

  // 如果没有通过 XML 获取到帧，按文件名排序分配
  if (frames.length === 0) {
    const maxFrames = SPRITE_ROWS * SPRITE_COLS;
    for (let i = 0; i < imageFiles.length && i < maxFrames; i++) {
      const row = Math.floor(i / SPRITE_COLS);
      const col = i % SPRITE_COLS;
      const imgPath = path.join(extractedDir, imageFiles[i]);
      const buffer = fs.readFileSync(imgPath);
      frames.push({ buffer, row, col });
    }
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
