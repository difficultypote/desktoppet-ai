import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron', 'express', 'cors', 'multer', 'adm-zip', 'sharp'],
            },
          },
        },
      },
      {
        entry: 'src/main/preload.ts',
        onstart({ reload }) {
          reload();
        },
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      input: {
        pet: resolve(__dirname, 'src/renderer/pet/index.html'),
        config: resolve(__dirname, 'src/renderer/config/index.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
});
