import { useState, useEffect, useRef } from 'react';
import type { ChatMessage, AIServiceState } from '../shared/types';
import { HTTP_SERVER_PORT } from '../shared/constants';

/**
 * ChatHistory — 对话历史页面
 * 显示对话记录 + 流式聊天输入框 + 清空历史
 * 回复内容流式显示，同时通过 configAPI.notifyPetState() 驱动桌宠状态
 */
export default function ChatHistory() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载历史记录
  useEffect(() => {
    window.configAPI
      .getHistory()
      .then((history) => {
        setMessages(history);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    // 构建发送给 API 的消息（排除 system 角色和空内容）
    const messagesToSend = [...messages, userMessage].filter(
      (m) => m.role !== 'system' && m.content,
    );

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setStreaming(true);

    try {
      const response = await fetch(`http://localhost:${HTTP_SERVER_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesToSend }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('API 返回了空响应');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));

            if (json.type === 'state') {
              // 驱动桌宠状态
              window.configAPI.notifyPetState(
                json.state as AIServiceState,
                json.text,
              );
            } else if (json.type === 'content') {
              // 流式追加内容到最后一条助手消息
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + json.content,
                  };
                }
                return updated;
              });
            } else if (json.type === 'error') {
              // 错误信息追加到最后一条助手消息
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content || `错误: ${json.error}`,
                  };
                }
                return updated;
              });
            }
            // json.type === 'done' 时流自然结束
          } catch {
            // 跳过无法解析的行
          }
        }
      }
    } catch (err) {
      // 网络或解析错误
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: `请求失败: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
        return updated;
      });
    } finally {
      setStreaming(false);
      // 恢复桌宠为空闲状态
      window.configAPI.notifyPetState('idle');
    }
  };

  const handleClear = async () => {
    if (!window.confirm('确定要清空所有对话历史吗？')) return;
    try {
      await window.configAPI.clearHistory();
      setMessages([]);
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return <div className="loading-text">加载对话历史中…</div>;
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <span className="chat-header-title">对话历史</span>
        <button
          className="btn btn-small btn-danger"
          onClick={handleClear}
          disabled={streaming || messages.length === 0}
        >
          清空历史
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">还没有对话记录，发送一条消息开始聊天吧</div>
        ) : (
          messages.map((msg, i) => {
            const isStreamingLast =
              streaming &&
              i === messages.length - 1 &&
              msg.role === 'assistant';
            return (
              <div
                key={i}
                className={`chat-message ${msg.role} ${isStreamingLast ? 'streaming' : ''}`}
              >
                {msg.content || (isStreamingLast ? '' : '(空)')}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder="输入消息…（Enter 发送，Shift+Enter 换行）"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          rows={1}
        />
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={streaming || !input.trim()}
        >
          {streaming ? '回复中…' : '发送'}
        </button>
      </div>
    </div>
  );
}
