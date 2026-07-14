// ============================================================
// PetApp.tsx -- 桌宠主组件
// 管理宠物状态 / 加载 spritesheet / 渲染 PetCanvas + SpeechBubble
// 处理空闲随机动画 / 监听 IPC 事件（状态 / 任务 / 文本 / 宠物切换 / fps）
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PetAnimationState, PetMetadata, PetTask } from '../../shared/types';
import {
  DEFAULT_FPS,
  STATE_TEXT_MAP,
  HTTP_SERVER_PORT,
} from '../../shared/constants';
import { PetCanvas } from './PetCanvas';
import { SpeechBubble } from './SpeechBubble';

/** 空闲时随机播放的动画及持续时间 */
const IDLE_ANIMATIONS: { state: PetAnimationState; duration: number }[] = [
  { state: 'jumping', duration: 2000 },
  { state: 'waving', duration: 3000 },
  { state: 'running-right', duration: 3000 },
  { state: 'running-left', duration: 3000 },
  { state: 'waiting', duration: 4000 },
  { state: 'review', duration: 3000 },
];

/** 随机间隔范围（毫秒） */
const IDLE_MIN_INTERVAL = 8000;
const IDLE_MAX_INTERVAL = 25000;

export const PetApp: React.FC = () => {
  // ---- 状态 ----
  const [currentPet, setCurrentPet] = useState<PetMetadata | null>(null);
  const [currentState, setCurrentState] = useState<PetAnimationState>('idle');
  const [statusText, setStatusText] = useState('');
  const [tasks, setTasks] = useState<PetTask[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [spriteImage, setSpriteImage] = useState<HTMLImageElement | null>(null);
  const [fps, setFps] = useState(DEFAULT_FPS);
  const [isVisible, setIsVisible] = useState(true);

  // ---- refs ----
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- 加载当前宠物（挂载时） ----
  useEffect(() => {
    window.petAPI.getCurrentPet().then((pet) => {
      if (pet) {
        setCurrentPet(pet);
      }
    });
    // 加载动画帧速
    window.petAPI.getAnimationFps().then((f) => setFps(f));
    // 加载可见性
    window.petAPI.isPetVisible().then((v) => setIsVisible(v));
  }, []);

  // ---- 加载 spritesheet 图片（宠物切换时） ----
  useEffect(() => {
    if (!currentPet) {
      setSpriteImage(null);
      return;
    }

    const img = new Image();
    img.onload = () => setSpriteImage(img);
    img.onerror = () => {
      console.error(`[PetApp] Failed to load spritesheet for pet: ${currentPet.id}`);
      setSpriteImage(null);
    };
    img.src = `http://localhost:${HTTP_SERVER_PORT}/api/pets/${currentPet.id}/spritesheet`;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [currentPet]);

  // ---- 监听 IPC 事件 ----
  useEffect(() => {
    const unsubState = window.petAPI.onStateChange((state) => {
      setCurrentState(state);
      if (state === 'idle') {
        setStatusText('');
      }
    });

    const unsubTasks = window.petAPI.onTasksUpdate((newTasks) => {
      setTasks(newTasks);
    });

    const unsubStatus = window.petAPI.onStatusTextChange((text) => {
      setStatusText(text);
    });

    const unsubPet = window.petAPI.onPetChange((pet) => {
      setCurrentPet(pet);
      setCurrentState('idle');
      setStatusText('');
      setTasks([]);
    });

    // 监听动画帧速变化
    const unsubFps = window.petAPI.onAnimationFpsChange((newFps) => {
      setFps(newFps);
    });

    // 监听可见性变化
    const unsubVis = window.petAPI.onVisibilityChange((visible) => {
      setIsVisible(visible);
    });

    return () => {
      unsubState();
      unsubTasks();
      unsubStatus();
      unsubPet();
      unsubFps();
      unsubVis();
    };
  }, []);

  // ---- 空闲随机动画 ----
  useEffect(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (currentState !== 'idle') {
      return;
    }

    // 随机间隔 8~25 秒
    const randomInterval = IDLE_MIN_INTERVAL + Math.random() * (IDLE_MAX_INTERVAL - IDLE_MIN_INTERVAL);

    idleTimerRef.current = setTimeout(() => {
      const pick = IDLE_ANIMATIONS[Math.floor(Math.random() * IDLE_ANIMATIONS.length)];
      setCurrentState(pick.state);
    }, randomInterval);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [currentState]);

  // ---- 空闲动画自动恢复 idle ----
  useEffect(() => {
    if (stateResetTimerRef.current) {
      clearTimeout(stateResetTimerRef.current);
      stateResetTimerRef.current = null;
    }

    // 查找当前状态对应的持续时间
    const animConfig = IDLE_ANIMATIONS.find((a) => a.state === currentState);
    // jumping/waving 有固定时长，其他随机动画也用配置时长
    let duration: number | null = null;
    if (animConfig) {
      duration = animConfig.duration;
    }

    if (duration !== null) {
      stateResetTimerRef.current = setTimeout(() => {
        setCurrentState('idle');
      }, duration);
    }

    return () => {
      if (stateResetTimerRef.current) {
        clearTimeout(stateResetTimerRef.current);
        stateResetTimerRef.current = null;
      }
    };
  }, [currentState]);

  // ---- 回调 ----
  const handleHoverChange = useCallback((hovered: boolean) => {
    setIsHovered(hovered);
  }, []);

  // ---- 计算气泡显示内容 ----
  const hoverText = isHovered ? STATE_TEXT_MAP[currentState] : '';
  const displayText = statusText || hoverText;
  const bubbleVisible = tasks.length > 0 || displayText.length > 0;

  // 如果不可见，不渲染任何内容
  if (!isVisible) return null;

  return (
    <div className="pet-container">
      <PetCanvas
        image={spriteImage}
        currentState={currentState}
        fps={fps}
        onHoverChange={handleHoverChange}
      />

      <SpeechBubble
        text={displayText}
        tasks={tasks}
        visible={bubbleVisible}
      />
    </div>
  );
};
