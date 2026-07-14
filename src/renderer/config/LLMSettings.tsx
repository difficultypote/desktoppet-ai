import { useState, useEffect } from 'react';
import type { LLMConfig } from '../../shared/types';
import { DEFAULT_LLM_CONFIG, HTTP_SERVER_PORT } from '../../shared/constants';

/** 预设 LLM 接口配置 */
const LLM_PRESETS: { name: string; apiEndpoint: string; model: string }[] = [
  { name: 'OpenAI', apiEndpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'DeepSeek', apiEndpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'Moonshot', apiEndpoint: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: 'SiliconFlow', apiEndpoint: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  { name: 'Ollama', apiEndpoint: 'http://localhost:11434/v1', model: 'llama3' },
];

interface FormMessage {
  type: 'success' | 'error';
  text: string;
}

/**
 * LLMSettings — LLM API 配置表单
 * 字段：apiEndpoint, apiKey, model, systemPrompt, temperature, maxTokens
 * 支持预设接口选择、保存配置、测试连接
 */
export default function LLMSettings() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<FormMessage | null>(null);

  useEffect(() => {
    window.configAPI
      .getConfig()
      .then((cfg) => {
        setConfig(cfg);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const update = <K extends keyof LLMConfig,>(key: K, value: LLMConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = LLM_PRESETS.find((p) => p.name === e.target.value);
    if (preset) {
      setConfig((prev) => ({
        ...prev,
        apiEndpoint: preset.apiEndpoint,
        model: preset.model,
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await window.configAPI.saveConfig(config);
      setMessage({ type: 'success', text: '配置已保存' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: `保存失败: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      // 先保存配置，让服务器使用最新设置
      await window.configAPI.saveConfig(config);

      // 通过内嵌 HTTP 服务器发送测试消息，验证 API 连通性
      const response = await fetch(`http://localhost:${HTTP_SERVER_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      if (!response.ok) {
        setMessage({ type: 'error', text: `HTTP 错误: ${response.status}` });
        return;
      }

      if (!response.body) {
        setMessage({ type: 'error', text: 'API 返回了空响应' });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const startTime = Date.now();

      while (true) {
        // 超时保护（20 秒）
        if (Date.now() - startTime > 20000) {
          await reader.cancel();
          setMessage({ type: 'error', text: '测试超时，请检查网络或 API 配置' });
          return;
        }

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
            if (json.type === 'error') {
              await reader.cancel();
              setMessage({ type: 'error', text: `连接失败: ${json.error}` });
              return;
            }
            // 收到内容说明 API Key 有效、连接正常
            if (json.type === 'content') {
              await reader.cancel();
              setMessage({ type: 'success', text: '连接成功！API 响应正常' });
              return;
            }
            if (json.type === 'done') {
              setMessage({ type: 'success', text: '连接成功！API 响应正常' });
              return;
            }
          } catch {
            // 跳过无法解析的行
          }
        }
      }
      setMessage({ type: 'error', text: '未收到有效响应，请检查 API Key 和 Endpoint' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: `测试失败: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="loading-text">加载配置中…</div>;
  }

  return (
    <div className="llm-settings">
      <div className="section-card">
        <h2 className="section-title">LLM API 配置</h2>

        <div className="form-group">
          <label className="form-label">预设接口</label>
          <div className="preset-row">
            <select
              className="form-select"
              value=""
              onChange={handlePresetChange}
            >
              <option value="" disabled>
                选择预设接口以快速填充…
              </option>
              {LLM_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">API Endpoint</label>
          <input
            className="form-input"
            type="text"
            value={config.apiEndpoint}
            onChange={(e) => update('apiEndpoint', e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <div className="form-group">
          <label className="form-label">API Key</label>
          <input
            className="form-input"
            type="password"
            value={config.apiKey}
            onChange={(e) => update('apiKey', e.target.value)}
            placeholder="sk-..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">模型名称</label>
          <input
            className="form-input"
            type="text"
            value={config.model}
            onChange={(e) => update('model', e.target.value)}
            placeholder="gpt-4o-mini"
          />
        </div>

        <div className="form-group">
          <label className="form-label">系统提示词</label>
          <textarea
            className="form-textarea"
            value={config.systemPrompt}
            onChange={(e) => update('systemPrompt', e.target.value)}
            placeholder="你是一个友好的桌面助手。"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Temperature（创造性）</label>
          <div className="form-slider-row">
            <input
              className="form-slider"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.temperature}
              onChange={(e) => update('temperature', parseFloat(e.target.value))}
            />
            <span className="form-slider-value">{config.temperature.toFixed(1)}</span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Max Tokens（最大输出长度）</label>
          <input
            className="form-input"
            type="number"
            min="1"
            max="32768"
            value={config.maxTokens}
            onChange={(e) => update('maxTokens', parseInt(e.target.value, 10) || 0)}
          />
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存配置'}
          </button>
          <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? '测试中…' : '测试连接'}
          </button>
        </div>

        {message && <div className={`form-message ${message.type}`}>{message.text}</div>}
      </div>
    </div>
  );
}
