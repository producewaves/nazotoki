import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages（https://<owner>.github.io/nazotoki/）でも動くよう相対パスで出力する
  base: './',
  plugins: [react()],
})
