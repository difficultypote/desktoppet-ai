// ============================================================
// main.tsx -- React 入口
// 挂载 PetApp 到 #root
// ============================================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import { PetApp } from './PetApp';
import '../styles/pet.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <PetApp />
  </React.StrictMode>,
);
