// ============================================================
// http-server.ts — 内嵌 Express 服务器
// 端口 31750，提供 REST API 供配置窗口前端调用
// ============================================================

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import type { LLMConfig, ChatMessage } from '../renderer/shared/types';
import { HTTP_SERVER_PORT } from '../renderer/shared/constants';
import { listPets, deletePet, getPetsDir } from './pet-loader';
import { loadConfig, saveConfig, loadHistory, clearHistory, chatStream } from './ai-service';
import { importPetPackage } from './pet-importer/index';

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const tempDir = path.join(os.tmpdir(), 'desktoppet-uploads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
});

let server: express.Express | null = null;

/**
 * 启动内嵌 HTTP 服务器
 */
export function startHttpServer(): express.Express {
  if (server) return server;

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // ---- LLM 配置 ----

  app.get('/api/config', (_req, res) => {
    res.json(loadConfig());
  });

  app.put('/api/config', (req, res) => {
    const config = req.body as LLMConfig;
    saveConfig(config);
    res.json({ success: true });
  });

  // ---- 宠物管理 ----

  app.get('/api/pets', (_req, res) => {
    res.json(listPets());
  });

  app.post('/api/pets/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: '未上传文件' });
        return;
      }

      const name = (req.body.name as string) || path.basename(req.file.originalname);
      const description = (req.body.description as string) || '';

      const result = await importPetPackage(req.file.path, name, description);
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/pets/:id', (req, res) => {
    deletePet(req.params.id);
    res.json({ success: true });
  });

  // 获取宠物的 spritesheet 图片
  app.get('/api/pets/:id/spritesheet', (req, res) => {
    const petDir = path.join(getPetsDir(), req.params.id);
    const petJsonPath = path.join(petDir, 'pet.json');

    if (!fs.existsSync(petJsonPath)) {
      res.status(404).send('Pet not found');
      return;
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(petJsonPath, 'utf-8'));
      const spritePath = path.join(petDir, metadata.spritesheet);
      if (fs.existsSync(spritePath)) {
        res.sendFile(spritePath);
      } else {
        res.status(404).send('Spritesheet not found');
      }
    } catch {
      res.status(500).send('Failed to read pet metadata');
    }
  });

  // ---- 对话 ----

  app.get('/api/history', (_req, res) => {
    res.json(loadHistory());
  });

  app.delete('/api/history', (_req, res) => {
    clearHistory();
    res.json({ success: true });
  });

  app.post('/api/chat', async (req, res) => {
    const messages = req.body.messages as ChatMessage[];
    const config = loadConfig();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullContent = '';

    await chatStream(messages, config, {
      onState: (state, text) => {
        res.write(`data: ${JSON.stringify({ type: 'state', state, text })}\n\n`);
      },
      onContent: (chunk) => {
        fullContent += chunk;
        res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
      },
      onDone: () => {
        res.write(`data: ${JSON.stringify({ type: 'done', fullContent })}\n\n`);
        res.end();
      },
    });
  });

  // 获取/设置宠物可见性
  app.get('/api/pet/visible', (_req, res) => {
    const { BrowserWindow } = require('electron');
    const petWindow = BrowserWindow.getAllWindows().find((w: any) => w.isVisible() === false || w.isVisible() === true);
    // 简单返回 true（配置窗口初始化时调用）
    res.json({ visible: true });
  });

  app.post('/api/pet/visible', (req, res) => {
    const { visible } = req.body;
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    // petWin 是第一个创建的窗口（透明窗口）
    const petWindow = windows.find((w: any) => {
      try {
        return w.isAlwaysOnTop();
      } catch {
        return false;
      }
    });
    if (petWindow) {
      if (visible) {
        petWindow.show();
      } else {
        petWindow.hide();
      }
      petWindow.webContents.send('pet-visibility-changed', visible);
    }
    res.json({ success: true });
  });

  // 获取动画帧速
  app.get('/api/pet/fps', (_req, res) => {
    const config = loadConfig();
    res.json({ fps: (config as any).animationFps || 12 });
  });

  // 设置动画帧速
  app.put('/api/pet/fps', (req, res) => {
    const { fps } = req.body;
    const config = loadConfig();
    const updated = { ...config, animationFps: fps };
    saveConfig(updated);
    // 通知桌宠窗口
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    const petWindow = windows.find((w: any) => {
      try {
        return w.isAlwaysOnTop();
      } catch {
        return false;
      }
    });
    if (petWindow) {
      petWindow.webContents.send('pet-fps-changed', fps);
    }
    res.json({ success: true });
  });

  const httpServer = app.listen(HTTP_SERVER_PORT, () => {
    console.log(`[DesktopPet] HTTP server running on http://localhost:${HTTP_SERVER_PORT}`);
  });

  httpServer.on('error', (err: Error) => {
    console.error(`[DesktopPet] HTTP server error:`, err);
  });

  server = app;
  return app;
}
