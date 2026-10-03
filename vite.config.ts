import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  ...(command === 'build'
    ? {
        build: {
          lib: {
            entry: 'src/index.ts',
            formats: ['es'] as const,
            fileName: 'index',
            cssFileName: 'edgeweft',
          },
          rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime', 'three', /^three\//, /^@react-three\//],
          },
        },
      }
    : {}),
}));
