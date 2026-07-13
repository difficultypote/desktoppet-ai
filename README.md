# DesktopPet AI — Windows AI 桌面宠物

基于 Electron 的 Windows 桌面 AI 宠物应用。透明悬浮窗口 + Canvas 动画 + LLM API 集成 + 多格式宠物导入。

## 技术栈

- **Electron 30** — 主进程 + 透明窗口
- **React 18 + TypeScript** — 渲染层
- **Canvas 2D** — spritesheet 帧动画
- **Express** — 内嵌 HTTP 服务器（端口 31750）
- **Vite + vite-plugin-electron** — 构建工具链
- **sharp** — 图片处理（spritesheet 拼合）
- **adm-zip** — 宠物包解压

## 项目结构

```
desktoppet-ai/
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── index.ts               # 入口：创建窗口+托盘+IPC+HTTP
│   │   ├── preload.ts             # contextBridge 安全 API
│   │   ├── pet-window.ts          # 透明悬浮窗口（alwaysOnTop + 鼠标穿透）
│   │   ├── config-window.ts       # 配置窗口（普通窗口）
│   │   ├── tray.ts                # 系统托盘图标+右键菜单
│   │   ├── ipc-handlers.ts        # IPC 通信（窗口间消息中转）
│   │   ├── ai-service.ts          # LLM API 调用（SSE 流式）
│   │   ├── http-server.ts         # Express 服务器（REST API）
│   │   ├── pet-loader.ts          # 宠物包加载（~/.codex/pets/）
│   │   └── pet-importer/          # 宠物格式转换器
│   │       ├── index.ts           # 导入入口
│   │       ├── detector.ts        # 格式识别
│   │       ├── sprite-builder.ts  # spritesheet 拼合
│   │       ├── pet-packager.ts    # pet.json 生成+打包
│   │       ├── codex-importer.ts  # Codex 原生包
│   │       ├── shimeji-importer.ts# Shimeji 格式
│   │       ├── gif-importer.ts    # GIF 拆帧
│   │       ├── frames-importer.ts # 散装帧拼合
│   │       └── single-importer.ts # 单张图片扩展
│   └── renderer/                  # React 渲染层
│       ├── shared/                # 共享类型+常量
│       │   ├── types.ts           # TypeScript 类型定义
│       │   ├── constants.ts       # Spritesheet 常量+状态映射
│       │   └── pet-utils.ts       # 帧坐标计算+ID生成
│       ├── pet/                   # 桌宠窗口
│       │   ├── index.html
│       │   ├── main.tsx
│       │   ├── PetApp.tsx         # 主组件（状态管理+空闲动画）
│       │   ├── PetCanvas.tsx      # Canvas 动画渲染+鼠标交互
│       │   ├── SpeechBubble.tsx   # 状态气泡
│       │   └── useSpriteAnimation.ts # 帧动画 Hook
│       ├── config/                # 配置窗口
│       │   ├── index.html
│       │   ├── main.tsx
│       │   ├── ConfigApp.tsx      # 主组件（标签页导航）
│       │   ├── LLMSettings.tsx    # LLM API 配置表单
│       │   ├── PetManager.tsx     # 宠物管理+上传
│       │   ├── ChatHistory.tsx    # 对话历史+聊天
│       │   └── PreviewPanel.tsx   # 宠物动画预览
│       └── styles/
│           ├── pet.css            # 桌宠窗口样式
│           └── config.css         # 配置窗口样式
├── resources/
│   ├── default-pets/
│   │   └── spritesheet.png        # 默认宠物精灵图（1536x1872）
│   └── tray-icon.png              # 托盘图标（16x16）
├── scripts/
│   └── generate-default-spritesheet.js # 资源生成脚本
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

## Spritesheet 规范

```
图集尺寸: 1536 x 1872 px
帧布局:   8 列 x 9 行 = 72 帧
单帧尺寸: 192 x 208 px
```

### 动画状态行号映射

| 行号 | 状态 | 说明 |
|------|------|------|
| 0 | idle | 空闲呼吸 |
| 1 | running-right | 向右移动 |
| 2 | running-left | 向左移动 |
| 3 | waving | 欢呼（任务完成） |
| 4 | jumping | 跳跃（随机动画） |
| 5 | failed | 失败（出错） |
| 6 | waiting | 等待输入 |
| 7 | running | 运行中（生成中） |
| 8 | review | 思考中 |

### AI 状态 → 桌宠状态映射

| AI 服务状态 | 桌宠动画 | 状态文本 |
|------------|---------|---------|
| idle | idle | — |
| thinking | review | 正在思考… |
| generating | running | 正在生成… |
| waiting-input | waiting | 等待你的输入 |
| error | failed | 出错了 |
| done | waving | 完成！ |

## 宠物格式支持

| 格式 | 识别方式 | 转换方法 |
|------|---------|---------|
| Codex | pet.json + spritesheet.png | 直接拷贝 |
| Shimeji | conf/ 或 .xml | 解析 XML 动作名映射 |
| Live2D | .model3.json / .moc3 | 提取静态帧（降级） |
| GIF | .gif 文件 | sharp 拆帧分配到 9 行 |
| Frames | 多张图片 | 按文件名排序拼合 |
| Single | 单张图片 | 复制到 72 帧 |

## LLM API 配置

兼容 OpenAI 格式的 `/v1/chat/completions` 接口，支持：

- OpenAI（gpt-4o-mini）
- DeepSeek（deepseek-chat）
- Moonshot（moonshot-v1-8k）
- SiliconFlow（自定义模型）
- Ollama（本地模型）

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（同时启动 Vite + Electron）
npm run dev

# 构建生产版本
npm run build

# 打包 Windows 安装包
npm run build:win
```

## API 端点

内嵌 Express 服务器（端口 31750）：

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/config | 获取 LLM 配置 |
| PUT | /api/config | 保存 LLM 配置 |
| GET | /api/pets | 获取宠物列表 |
| POST | /api/pets/upload | 上传宠物包 |
| DELETE | /api/pets/:id | 删除宠物 |
| GET | /api/pets/:id/spritesheet | 获取精灵图 |
| GET | /api/history | 获取对话历史 |
| DELETE | /api/history | 清空对话历史 |
| POST | /api/chat | SSE 流式聊天 |

## 数据存储

- 宠物包: `~/.codex/pets/<pet-id>/`
  - `pet.json` — 元数据
  - `spritesheet.png` — 精灵图
- 配置: `~/.desktoppet/config.json`
- 历史: `~/.desktoppet/history.json`
- 当前宠物: `~/.desktoppet/current-pet.txt`

## 核心特性

1. **透明悬浮窗口** — `transparent: true` + `frame: false` + `alwaysOnTop: true`
2. **鼠标穿透** — `setIgnoreMouseEvents(true, { forward: true })`，悬停时自动关闭
3. **拖拽移动** — 按住拖拽，松手恢复穿透
4. **双击聚焦** — 双击桌宠打开配置窗口
5. **系统托盘** — 右键菜单（显示/隐藏、设置、退出）
6. **空闲随机动画** — 15 秒间隔随机播放跳跃/欢呼
7. **状态驱动动画** — AI 服务状态实时映射到桌宠动画
8. **多格式宠物导入** — 支持 Codex/Shimeji/GIF/散帧/单图
9. **SSE 流式聊天** — 实时显示 AI 回复，同步驱动桌宠状态
10. **动画预览** — 配置窗口中预览 9 种动画状态
