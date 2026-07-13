// ============================================================
// SpeechBubble.tsx -- 对话气泡 / 状态文本组件
// 在桌宠下方显示状态文本或多任务列表，半透明圆角背景 + 淡入淡出
// ============================================================

import React from 'react';
import type { PetTask } from '../shared/types';

interface SpeechBubbleProps {
  /** 状态文本（如"正在思考…"） */
  text: string;
  /** 任务列表（多任务并行时显示） */
  tasks: PetTask[];
  /** 是否可见 */
  visible: boolean;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  tasks,
  visible,
}) => {
  const hasTasks = tasks.length > 0;
  const hasText = text.length > 0;
  const isVisible = visible && (hasTasks || hasText);

  const classNames = [
    'speech-bubble',
    isVisible ? 'visible' : '',
    hasTasks ? 'tasks' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames}>
      {hasTasks ? (
        <div className="task-list">
          {tasks.map((task) => (
            <div key={task.id} className="task-item">
              <span className={`task-dot ${task.state}`} />
              <span className="task-title">{task.title}</span>
            </div>
          ))}
        </div>
      ) : hasText ? (
        <span className="status-text">{text}</span>
      ) : null}
    </div>
  );
};
