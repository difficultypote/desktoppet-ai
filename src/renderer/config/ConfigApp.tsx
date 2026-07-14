import { useState, useEffect, useRef } from 'react';
import LLMSettings from './LLMSettings';
import PetManager from './PetManager';
import ChatHistory from './ChatHistory';
import GeneralSettings from './GeneralSettings';

type Tab = 'general' | 'llm' | 'pets' | 'chat';

const TABS: { key: Tab; label: string }[] = [
  { key: 'general', label: '通用设置' },
  { key: 'llm', label: 'LLM 设置' },
  { key: 'pets', label: '宠物管理' },
  { key: 'chat', label: '对话历史' },
];

/**
 * ConfigApp — 配置窗口主组件
 * 左侧标签页导航 + 右侧内容区域 + 顶部标题栏
 */
export default function ConfigApp() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const contentRef = useRef<HTMLElement | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 切换 Tab 时重置内容区滚动位置到顶部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    setShowBackToTop(false);
  }, [activeTab]);

  // 监听滚动，超过 200px 时显示"回到顶部"按钮
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handleScroll = () => setShowBackToTop(el.scrollTop > 200);
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBackToTop = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">DesktopPet AI 设置</h1>
      </header>
      <div className="app-body">
        <nav className="app-sidebar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`sidebar-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <main className="app-content" ref={contentRef}>
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'llm' && <LLMSettings />}
          {activeTab === 'pets' && <PetManager />}
          {activeTab === 'chat' && <ChatHistory />}
          {showBackToTop && (
            <button
              className="back-to-top-btn"
              onClick={handleBackToTop}
              title="回到顶部"
              aria-label="回到顶部"
            >
              ↑
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
