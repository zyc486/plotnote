import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/douban-book': {
        target: 'https://book.douban.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/douban-book/, ''),
      },
    },
  },
})
