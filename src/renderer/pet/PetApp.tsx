// ============================================================
// PetApp.tsx -- 桌宠主组件
// 管理宠物状态 / 加载 spritesheet / 渲染 PetCanvas + SpeechBubble + ChatBubble
// 左键点击桌宠弹出对话气泡窗，回车发送消息
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PetAnimationState, PetMetadata, PetTask, ChatMessage } from '../../shared/types';
import {
  DEFAULT_FPS,
  STATE_TEXT_MAP,
  HTTP_SERVER_PORT,
} from '../../shared/constants';
import { PetCanvas } from './PetCanvas';
import { SpeechBubble } from './SpeechBubble';
import { ChatBubble } from './ChatBubble';

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

/** 长期无交互进入休息的延迟（毫秒） */
const REST_DELAY = 45000; // 45 秒无交互 → 休息

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

  // ---- 拖拽方向覆盖状态（拖拽时优先使用此状态） ----
  const [dragOverrideState, setDragOverrideState] = useState<PetAnimationState | null>(null);

  // ---- 对话气泡状态 ----
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // ---- refs ----
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 上一次 hover 状态，用于检测"进入"瞬间
  const prevHoverRef = useRef(false);

  /** 重置休息定时器（任何交互都应调用） */
  const resetRestTimer = useCallback(() => {
    if (restTimerRef.current) {
      clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
    // 如果当前在休息状态，唤醒回 idle
    setCurrentState((prev) => (prev === 'waiting' ? 'idle' : prev));
    // 启动新的休息定时器
    restTimerRef.current = setTimeout(() => {
      setCurrentState('waiting'); // 进入休息
    }, REST_DELAY);
  }, []);

  // ---- 加载当前宠物（挂载时） ----
  useEffect(() => {
    window.petAPI.getCurrentPet().then((pet) => {
      if (pet) {
        setCurrentPet(pet);
      }
    }).catch(() => {});
    window.petAPI.getAnimationFps().then((f) => setFps(f)).catch(() => {});
    window.petAPI.isPetVisible().then((v) => setIsVisible(v)).catch(() => {});
    // 加载历史对话
    window.petAPI.getHistory().then((h) => {
      if (h && h.length > 0) setChatMessages(h);
    }).catch(() => {});
  }, []);

  // ---- 加载 spritesheet 图片（宠物切换时） ----
  useEffect(() => {
    if (!currentPet) {
      setSpriteImage(null);
      return;
    }
    const img = new Image();
    img.onload = () => setSpriteImage(img);
    img.onerror = () => setSpriteImage(null);
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
      if (state === 'idle') setStatusText('');
    });
    const unsubTasks = window.petAPI.onTasksUpdate((newTasks) => setTasks(newTasks));
    const unsubStatus = window.petAPI.onStatusTextChange((text) => setStatusText(text));
    const unsubPet = window.petAPI.onPetChange((pet) => {
      setCurrentPet(pet);
      setCurrentState('idle');
      setStatusText('');
      setTasks([]);
    });
    const unsubFps = window.petAPI.onAnimationFpsChange((newFps) => setFps(newFps));
    const unsubVis = window.petAPI.onVisibilityChange((visible) => setIsVisible(visible));

    // 监听切换对话气泡
    const unsubToggle = window.petAPI.onToggleChat(() => {
      setChatVisible((prev) => !prev);
    });

    // 监听流式回复
    const unsubChunk = window.petAPI.onChatStreamChunk((chunk) => {
      setStreamingText((prev) => prev + chunk);
    });
    const unsubDone = window.petAPI.onChatStreamDone((fullText) => {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: fullText, timestamp: Date.now() }]);
      setStreamingText('');
      setIsThinking(false);
    });
    const unsubError = window.petAPI.onChatStreamError((error) => {
      setStreamingText('');
      setIsThinking(false);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `[出错] ${error}`, timestamp: Date.now() }]);
    });

    return () => {
      unsubState();
      unsubTasks();
      unsubStatus();
      unsubPet();
      unsubFps();
      unsubVis();
      unsubToggle();
      unsubChunk();
      unsubDone();
      unsubError();
    };
  }, []);

  // ---- 空闲随机动画 ----
  // 拖拽中 / 休息中 不触发空闲动画
  const effectiveState = dragOverrideState ?? currentState;
  useEffect(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (dragOverrideState) return; // 拖拽中不启动空闲定时器
    if (currentState === 'waiting') return; // 休息中不启动随机动画
    if (currentState !== 'idle') return;

    // 进入 idle 时启动休息倒计时
    resetRestTimer();

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
  }, [currentState, dragOverrideState, resetRestTimer]);

  // ---- 空闲动画自动恢复 idle ----
  useEffect(() => {
    if (stateResetTimerRef.current) {
      clearTimeout(stateResetTimerRef.current);
      stateResetTimerRef.current = null;
    }
    if (dragOverrideState) return; // 拖拽中不启动自动恢复
    if (currentState === 'waiting') return; // 休息状态不自动恢复
    const animConfig = IDLE_ANIMATIONS.find((a) => a.state === currentState);
    let duration: number | null = null;
    if (animConfig) duration = animConfig.duration;
    if (duration !== null) {
      stateResetTimerRef.current = setTimeout(() => setCurrentState('idle'), duration);
    }
    return () => {
      if (stateResetTimerRef.current) {
        clearTimeout(stateResetTimerRef.current);
        stateResetTimerRef.current = null;
      }
    };
  }, [currentState, dragOverrideState]);

  // ---- 发送消息 ----
  const handleSend = useCallback(
    (text: string) => {
      const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
      const newMessages = [...chatMessages, userMsg];
      setChatMessages(newMessages);
      setStreamingText('');
      setIsThinking(true);
      resetRestTimer(); // 对话交互重置休息定时器

      // 发送给主进程（含历史消息）
      window.petAPI.chat(newMessages);
    },
    [chatMessages, resetRestTimer],
  );

  // ---- 拖拽方向回调 ----
  const handleDragStateChange = useCallback((state: PetAnimationState) => {
    if (state === 'idle') {
      setDragOverrideState(null);
      // 拖拽结束 → 重置休息定时器
      resetRestTimer();
    } else {
      setDragOverrideState(state);
    }
  }, [resetRestTimer]);

  // ---- hover 处理：进入时跳跃 + 重置休息定时器 ----
  const handleHoverChange = useCallback((hovered: boolean) => {
    setIsHovered(hovered);
    // 检测"进入"瞬间（false → true）
    if (hovered && !prevHoverRef.current) {
      // 鼠标进入 → 触发跳跃（如果当前是 idle 或休息状态）
      setCurrentState((prev) => {
        if (prev === 'idle' || prev === 'waiting') {
          return 'jumping';
        }
        return prev;
      });
      resetRestTimer();
    }
    prevHoverRef.current = hovered;
  }, [resetRestTimer]);

  // ---- 计算气泡显示内容 ----
  const activeState = dragOverrideState ?? currentState;
  const hoverText = isHovered ? STATE_TEXT_MAP[activeState] : '';
  const displayText = statusText || hoverText;
  const bubbleVisible = (tasks.length > 0 || displayText.length > 0) && !chatVisible;

  if (!isVisible) return null;

  return (
    <div className="pet-container">
      <PetCanvas
        image={spriteImage}
        currentState={activeState}
        fps={fps}
        onHoverChange={handleHoverChange}
        onDragStateChange={handleDragStateChange}
      />

      <SpeechBubble text={displayText} tasks={tasks} visible={bubbleVisible} />

      <ChatBubble
        visible={chatVisible}
        messages={chatMessages}
        streamingText={streamingText}
        isThinking={isThinking}
        onClose={() => setChatVisible(false)}
        onSend={handleSend}
      />
    </div>
  );
};

