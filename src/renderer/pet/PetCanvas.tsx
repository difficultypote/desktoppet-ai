// ============================================================
// PetCanvas.tsx -- Canvas 2D 动画渲染器
//
// 鼠标穿透由主进程 50ms 轮询管理，渲染层只负责：
// 1. 绘制 spritesheet 帧
// 2. 监听主进程推送的 hover 状态
// 3. 处理 mousedown（拖拽/单击）/ dblclick / 右键菜单
//
// 单击 vs 拖拽判定：
// mousedown 记录起始位置，mousemove 超过 5px 视为拖拽
// mouseup 时如果未拖拽则视为单击 → 打开设置
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { PetAnimationState } from '../../shared/types';
import { FRAME_WIDTH, FRAME_HEIGHT, DEFAULT_FPS } from '../../shared/constants';
import { getSpriteSourceRect } from '../../shared/pet-utils';
import { useSpriteAnimation } from './useSpriteAnimation';

interface PetCanvasProps {
  image: HTMLImageElement | null;
  currentState: PetAnimationState;
  fps?: number;
  onHoverChange?: (hovered: boolean) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/** 拖拽判定阈值（像素），移动超过此距离才视为拖拽 */
const DRAG_THRESHOLD = 5;

export const PetCanvas: React.FC<PetCanvasProps> = ({
  image,
  currentState,
  fps = DEFAULT_FPS,
  onHoverChange,
  onContextMenu,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // 拖拽/单击状态
  const mouseDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });

  // ref 避免闭包陷阱
  const onHoverChangeRef = useRef(onHoverChange);
  const onContextMenuRef = useRef(onContextMenu);

  useEffect(() => {
    onHoverChangeRef.current = onHoverChange;
  }, [onHoverChange]);
  useEffect(() => {
    onContextMenuRef.current = onContextMenu;
  }, [onContextMenu]);

  const frameIndex = useSpriteAnimation(currentState, fps);

  // ---- 绘制当前帧 ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { sx, sy, sw, sh } = getSpriteSourceRect(currentState, frameIndex);
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }, [image, currentState, frameIndex]);

  // ---- 监听主进程推送的 hover 状态 ----
  useEffect(() => {
    const unsub = window.petAPI.onHoverChange((hovered) => {
      setIsHovered(hovered);
      onHoverChangeRef.current?.(hovered);
    });
    return () => unsub();
  }, []);

  // ---- 全局 mousemove + mouseup（处理拖拽和单击判定）----
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!mouseDownRef.current) return;

      // 判定是否超过拖拽阈值
      if (!isDraggingRef.current) {
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          // 超过阈值 → 开始拖拽
          isDraggingRef.current = true;
          window.petAPI.startWindowDrag();
        }
      }

      // 拖拽中 → 通知主进程移动窗口
      if (isDraggingRef.current) {
        window.petAPI.moveWindow(0, 0);
      }
    };

    const handleGlobalMouseUp = () => {
      if (mouseDownRef.current) {
        if (!isDraggingRef.current) {
          // 未拖拽 → 视为单击 → 打开设置
          window.petAPI.focusApp();
        } else {
          // 拖拽结束
          window.petAPI.endWindowDrag();
        }
        mouseDownRef.current = false;
        isDraggingRef.current = false;
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // ---- 鼠标事件 ----

  /** 左键按下 — 记录起始位置，等待 mousemove 判定拖拽还是单击 */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    mouseDownRef.current = true;
    isDraggingRef.current = false;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  /** 双击 — 也打开设置（和单击一样，保持一致） */
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    window.petAPI.focusApp();
  }, []);

  /** 右键 — 弹出原生菜单（由主进程处理，不受窗口边界限制） */
  const handleContextMenuInternal = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      window.petAPI.showContextMenu();
    },
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      width={FRAME_WIDTH}
      height={FRAME_HEIGHT}
      className="pet-canvas"
      style={{ cursor: isHovered ? 'pointer' : 'default' }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenuInternal}
    />
  );
};
