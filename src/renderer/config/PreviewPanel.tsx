import { useState, useEffect, useRef } from 'react';
import type { PetAnimationState } from '../../shared/types';
import {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  SPRITE_COLS,
  STATE_ROW_MAP,
  ALL_PET_STATES,
  STATE_LABELS,
  HTTP_SERVER_PORT,
  DEFAULT_FPS,
} from '../../shared/constants';

interface PreviewPanelProps {
  petId: string;
}

/**
 * PreviewPanel — 宠物预览面板
 * 通过 Canvas 渲染指定宠物指定状态的动画帧
 * spritesheet 从内嵌 HTTP 服务器加载
 */
export default function PreviewPanel({ petId }: PreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef(0);
  const animRef = useRef<number | null>(null);

  const [currentState, setCurrentState] = useState<PetAnimationState>('idle');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [error, setError] = useState('');

  // 加载 spritesheet 图片
  useEffect(() => {
    setImageLoaded(false);
    setError('');
    imageRef.current = null;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      setError('无法加载精灵图');
    };
    img.src = `http://localhost:${HTTP_SERVER_PORT}/api/pets/${petId}/spritesheet`;

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [petId]);

  // 动画循环
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 重置帧索引
    frameRef.current = 0;

    let lastTime = 0;
    const frameInterval = 1000 / DEFAULT_FPS;

    const animate = (time: number) => {
      if (time - lastTime >= frameInterval) {
        lastTime = time;
        const row = STATE_ROW_MAP[currentState];
        const col = frameRef.current % SPRITE_COLS;
        const sx = col * FRAME_WIDTH;
        const sy = row * FRAME_HEIGHT;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          imageRef.current!,
          sx,
          sy,
          FRAME_WIDTH,
          FRAME_HEIGHT,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        frameRef.current = (frameRef.current + 1) % SPRITE_COLS;
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [imageLoaded, currentState]);

  // 通知主进程预览状态（可选，仅视觉预览）
  const handleStateChange = (state: PetAnimationState) => {
    setCurrentState(state);
    window.configAPI?.previewPet(petId, state);
  };

  return (
    <div className="preview-panel">
      <div className="preview-title">动画预览</div>
      <div className="preview-canvas-wrapper">
        {error ? (
          <div className="preview-error">{error}</div>
        ) : !imageLoaded ? (
          <div className="preview-loading">加载中…</div>
        ) : (
          <canvas
            ref={canvasRef}
            width={FRAME_WIDTH}
            height={FRAME_HEIGHT}
            className="preview-canvas"
          />
        )}
      </div>
      <div className="preview-states">
        {ALL_PET_STATES.map((state) => (
          <button
            key={state}
            className={`preview-state-btn ${currentState === state ? 'active' : ''}`}
            onClick={() => handleStateChange(state)}
          >
            {STATE_LABELS[state]}
          </button>
        ))}
      </div>
    </div>
  );
}
