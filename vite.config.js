import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://sk6594246.github.io/collageengine/
export default defineConfig({
  plugins: [react()],
  base: '/collageengine/',
})
