import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Resolve @call-to-cash/shared directly from TypeScript source so
      // deployment platforms (Zeabur, Netlify, etc.) do not need to
      // pre-build the shared package before running `vite build`.
      '@call-to-cash/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url)
      ),
    },
  },
})
