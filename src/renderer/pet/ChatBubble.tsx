// ============================================================
// ChatBubble.tsx -- 对话气泡窗组件
// 左键点击桌宠时弹出，包含输入框 + 消息列表
// 回车发送消息，AI 回复以气泡形式显示
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '../../shared/types';

interface ChatBubbleProps {
  visible: boolean;
  messages: ChatMessage[];
  streamingText: string;
  isThinking: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  visible,
  messages,
  streamingText,
  isThinking,
  onClose,
  onSend,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // 显示时自动聚焦输入框
  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const trimmed = input.trim();
        if (trimmed && !isThinking) {
          onSend(trimmed);
          setInput('');
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [input, isThinking, onSend, onClose],
  );

  if (!visible) return null;

  return (
    <div className="chat-bubble">
      {/* 头部 */}
      <div className="chat-bubble-header">
        <span className="chat-bubble-title">对话</span>
        <button className="chat-bubble-close" onClick={onClose} title="关闭">
          x
        </button>
      </div>

      {/* 消息列表 */}
      <div className="chat-bubble-messages">
        {messages.length === 0 && !streamingText && (
          <div className="chat-bubble-empty">输入消息开始对话~</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            <div className="chat-msg-text">{msg.content}</div>
          </div>
        ))}
        {/* 流式回复 */}
        {streamingText && (
          <div className="chat-msg assistant">
            <div className="chat-msg-text">{streamingText}</div>
          </div>
        )}
        {/* 思考中指示器 */}
        {isThinking && !streamingText && (
          <div className="chat-msg assistant">
            <div className="chat-msg-thinking">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="chat-bubble-input-area">
        <input
          ref={inputRef}
          className="chat-bubble-input"
          type="text"
          value={input}
          placeholder="输入消息，回车发送..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isThinking}
        />
      </div>
    </div>
  );
};
