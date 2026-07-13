// ============================================================
// useSpriteAnimation.ts -- spritesheet 帧动画 Hook
// 使用 setInterval 驱动帧索引递增
// 根据每个状态的有效帧数循环，跳过空白帧
// ============================================================

import { useState, useEffect, useRef } from 'react';
import type { PetAnimationState } from '../shared/types';
import { SPRITE_COLS, DEFAULT_FPS, STATE_FRAME_COUNTS } from '../shared/constants';

/**
 * 帧动画 Hook
 *
 * @param state  当前动画状态（决定 spritesheet 中的行）
 * @param fps    帧率，默认 12 fps
 * @returns 当前帧索引（0 ~ 有效帧数-1）
 */
export function useSpriteAnimation(
  state: PetAnimationState,
  fps: number = DEFAULT_FPS,
): number {
  const [frameIndex, setFrameIndex] = useState(0);
  const frameCountRef = useRef(STATE_FRAME_COUNTS[state] || SPRITE_COLS);

  useEffect(() => {
    // 获取当前状态的有效帧数
    const frameCount = STATE_FRAME_COUNTS[state] || SPRITE_COLS;
    frameCountRef.current = frameCount;

    // 状态切换时重置到第 0 帧
    setFrameIndex(0);

    const intervalMs = 1000 / fps;
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frameCount);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [state, fps]);

  return frameIndex;
}
