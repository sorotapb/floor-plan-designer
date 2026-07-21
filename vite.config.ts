import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base ตอน build ต้องเป็น '/<ชื่อ repo>/' สำหรับ GitHub Pages (project site)
// ตอน dev ใช้ '/' ปกติ
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/floor-plan-designer/' : '/',
  plugins: [react()],
}))
