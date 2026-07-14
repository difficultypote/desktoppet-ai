// ============================================================
// GeneralSettings.tsx — 通用设置页面
// 包含：动画速度调节、宠物显示/隐藏
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LLMConfig } from '../../shared/types';
import { DEFAULT_FPS } from '../../shared/constants';

export default function GeneralSettings() {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [fps, setFps] = useState(DEFAULT_FPS);
  const [savedHint, setSavedHint] = useState(false);
  const [petVisible, setPetVisible] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载配置
  useEffect(() => {
    window.configAPI.getConfig().then((c) => {
      setConfig(c);
      setFps(c.animationFps || DEFAULT_FPS);
    });
    fetch(`http://localhost:31750/api/pet/visible`)
      .then((r) => r.json())
      .then((data) => setPetVisible(data.visible ?? true))
      .catch(() => {});
  }, []);

  // 带防抖的保存
  const saveFps = useCallback((newFps: number) => {
    if (!config) return;

    // 立即同步更新本地状态，避免 UI 滞后
    const updated = { ...config, animationFps: newFps };
    setConfig(updated);

    // 通过 HTTP API 保存（更可靠，直接通知桌宠窗口）
    // HTTP 失败时降级为 IPC 保存
    fetch(`http://localhost:31750/api/pet/fps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fps: newFps }),
    }).catch(() => {
      // 降级：通过 IPC 保存
      window.configAPI.saveConfig(updated);
    });

    // 显示保存提示
    setSavedHint(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSavedHint(false), 1500);
  }, [config]);

  // 滑块变化时实时保存（防抖 300ms）
  const handleFpsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newFps = parseInt(e.target.value);
    setFps(newFps);

    // 防抖保存
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveFps(newFps);
    }, 300);
  }, [saveFps]);

  // 预设按钮立即保存
  const handlePresetClick = useCallback((preset: number) => {
    setFps(preset);
    saveFps(preset);
  }, [saveFps]);

  // 显示/隐藏宠物
  const handleToggleVisible = useCallback(() => {
    const newVisible = !petVisible;
    setPetVisible(newVisible);
    fetch(`http://localhost:31750/api/pet/visible`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: newVisible }),
    }).catch(() => {});
  }, [petVisible]);

  if (!config) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="general-settings">
      <h2 className="section-title">通用设置</h2>

      {/* 动画速度 */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>动画速度</h3>
          <span className="settings-value-badge">{fps} FPS</span>
        </div>
        <p className="settings-desc">
          调整宠物动画的播放帧率。数值越大动画越流畅但可能更消耗 CPU，数值越小动画越慢。
        </p>
        <div className="fps-slider-container">
          <span className="fps-label">慢</span>
          <input
            type="range"
            min="1"
            max="10"
            value={fps}
            onChange={handleFpsChange}
            className="fps-slider"
          />
          <span className="fps-label">快</span>
        </div>
        <div className="fps-presets">
          {[2, 4, 6, 8, 10].map((preset) => (
            <button
              key={preset}
              className={`fps-preset-btn ${fps === preset ? 'active' : ''}`}
              onClick={() => handlePresetClick(preset)}
            >
              {preset} FPS
            </button>
          ))}
        </div>
        {savedHint && <span className="saving-hint">已保存</span>}
      </div>

      {/* 宠物可见性 */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>宠物显示</h3>
        </div>
        <p className="settings-desc">
          隐藏后宠物将从桌面消失，可通过系统托盘图标重新显示。
        </p>
        <button
          className={`toggle-btn ${petVisible ? 'btn-danger' : 'btn-success'}`}
          onClick={handleToggleVisible}
        >
          {petVisible ? '隐藏宠物' : '显示宠物'}
        </button>
      </div>
    </div>
  );
}
