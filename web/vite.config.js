import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/components/layout/')) return 'app-layout';
          if (id.includes('/src/stores/')) return 'app-stores';
          if (id.includes('/src/lib/')) return 'app-lib';

          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts')) return 'charts';
          if (id.includes('framer-motion')) return 'motion-vendor';
          if (id.includes('@heroicons')) return 'icons-vendor';
          if (id.includes('@supabase') || id.includes('@tanstack/react-query')) return 'data-vendor';
          if (id.includes('react-day-picker') || id.includes('@internationalized/date') || id.includes('date-fns')) {
            return 'date-vendor';
          }
          if (id.includes('@hello-pangea/dnd')) return 'dnd-vendor';
          return undefined;
        },
      },
    },
  },
});
