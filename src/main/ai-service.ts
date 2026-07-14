// ============================================================
// ai-service.ts — LLM API 调用与流式转发
// 兼容 OpenAI 格式的 /v1/chat/completions 接口
// ============================================================

import type { LLMConfig, ChatMessage, AIServiceState } from '../shared/types';
import { DEFAULT_LLM_CONFIG } from '../shared/constants';
import fs from 'fs';
import path from 'path';
import { getConfigDir } from './pet-loader';
import { CONFIG_FILENAME, HISTORY_FILENAME } from '../shared/constants';

// ---- 配置读写 ----

export function loadConfig(): LLMConfig {
  const configPath = path.join(getConfigDir(), CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_LLM_CONFIG };
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return { ...DEFAULT_LLM_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

export function saveConfig(config: LLMConfig): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(configDir, CONFIG_FILENAME),
    JSON.stringify(config, null, 2),
    'utf-8',
  );
}

// ---- 对话历史读写 ----

export function loadHistory(): ChatMessage[] {
  const historyPath = path.join(getConfigDir(), HISTORY_FILENAME);
  if (!fs.existsSync(historyPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveHistory(messages: ChatMessage[]): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(configDir, HISTORY_FILENAME),
    JSON.stringify(messages, null, 2),
    'utf-8',
  );
}

export function clearHistory(): void {
  const historyPath = path.join(getConfigDir(), HISTORY_FILENAME);
  if (fs.existsSync(historyPath)) {
    fs.writeFileSync(historyPath, '[]', 'utf-8');
  }
}

// ---- SSE 流式聊天 ----

export interface ChatStreamCallbacks {
  onState: (state: AIServiceState, text?: string) => void;
  onContent: (chunk: string) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

/**
 * 发送聊天消息并流式返回
 * 兼容 OpenAI /v1/chat/completions 接口
 */
export async function chatStream(
  messages: ChatMessage[],
  config: LLMConfig,
  callbacks: ChatStreamCallbacks,
): Promise<void> {
  const { apiEndpoint, apiKey, model, systemPrompt, temperature, maxTokens } = config;

  if (!apiKey) {
    callbacks.onError('未配置 API Key，请在设置中填写');
    return;
  }

  // 构建请求消息（注入系统提示词）
  const fullMessages: ChatMessage[] = [];
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt });
  }
  fullMessages.push(...messages);

  const url = apiEndpoint.endsWith('/')
    ? `${apiEndpoint}chat/completions`
    : `${apiEndpoint}/chat/completions`;

  // 通知开始思考
  callbacks.onState('thinking', '正在思考…');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: fullMessages.map((m) => ({ role: m.role, content: m.content })),
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      callbacks.onError(`API 请求失败 (${response.status}): ${errorText}`);
      return;
    }

    if (!response.body) {
      callbacks.onError('API 返回了空响应体');
      return;
    }

    // 读取 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let hasStartedGenerating = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按行处理 SSE 数据
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后不完整的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6); // 去掉 "data: " 前缀
        if (data === '[DONE]') {
          callbacks.onState('done', '完成！点击查看结果');
          callbacks.onDone();
          return;
        }

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;

          if (delta?.content) {
            if (!hasStartedGenerating) {
              hasStartedGenerating = true;
              callbacks.onState('generating', '正在生成…');
            }
            fullContent += delta.content;
            callbacks.onContent(delta.content);
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }

    // 流结束但未收到 [DONE]
    if (fullContent) {
      callbacks.onState('done', '完成！');
      callbacks.onDone();
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    callbacks.onError(`网络错误: ${errorMsg}`);
  }
}
