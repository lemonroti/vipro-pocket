import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/vipro-pocket/',
  plugins: [vue(), tailwindcss()],
  test: { environment: 'node' },
})
