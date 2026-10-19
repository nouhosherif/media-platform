import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  // Keep API requests same-origin for LAN and tunnel visitors. The environment
  // variable remains available when the backend runs somewhere else.
  const backendProxyUrl = env.VITE_BACKEND_PROXY_URL?.trim() || 'http://127.0.0.1:8001'
  const backendUrl = backendProxyUrl?.startsWith('http')
    ? new URL(backendProxyUrl).origin
    : null

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['.trycloudflare.com'],
      ...(backendUrl && {
        proxy: {
          '/api': {
            target: backendUrl,
            changeOrigin: true,
          },
          '/media': {
            target: backendUrl,
            changeOrigin: true,
          },
        },
      }),
    },
  }
})
