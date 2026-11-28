import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Сайт публикуется в папке /kksu/ сайта NII (nii-arai-publishhouse.kz/kksu/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: '../kksu',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
