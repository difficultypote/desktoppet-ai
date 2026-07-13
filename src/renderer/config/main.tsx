import React from 'react';
import { createRoot } from 'react-dom/client';
import ConfigApp from './ConfigApp';
import '../styles/config.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ConfigApp />
  </React.StrictMode>,
);
