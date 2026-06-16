import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    fs: {
      // The project folder name contains a ":" which breaks Vite's
      // default fs allow-list path matching. Disable the strict check.
      strict: false,
    },
  },
})
