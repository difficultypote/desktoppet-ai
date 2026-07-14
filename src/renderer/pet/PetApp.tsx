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

  // ---- 对话气泡状态 ----
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

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
    window.petAPI.getAnimationFps().then((f) => setFps(f));
    window.petAPI.isPetVisible().then((v) => setIsVisible(v));
    // 加载历史对话
    window.petAPI.getHistory().then((h) => {
      if (h && h.length > 0) setChatMessages(h);
    });
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
  useEffect(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (currentState !== 'idle') return;
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
  }, [currentState]);

  // ---- 发送消息 ----
  const handleSend = useCallback(
    (text: string) => {
      const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
      const newMessages = [...chatMessages, userMsg];
      setChatMessages(newMessages);
      setStreamingText('');
      setIsThinking(true);

      // 发送给主进程（含历史消息）
      window.petAPI.chat(newMessages);
    },
    [chatMessages],
  );

  // ---- 计算气泡显示内容 ----
  const hoverText = isHovered ? STATE_TEXT_MAP[currentState] : '';
  const displayText = statusText || hoverText;
  const bubbleVisible = (tasks.length > 0 || displayText.length > 0) && !chatVisible;

  if (!isVisible) return null;

  return (
    <div className="pet-container">
      <PetCanvas
        image={spriteImage}
        currentState={currentState}
        fps={fps}
        onHoverChange={(hovered) => setIsHovered(hovered)}
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
