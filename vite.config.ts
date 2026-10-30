import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig(({ mode }) => {
  const name = loadEnv(mode, process.cwd(), '').VITE_APP_NAME || 'Hermora'
  return {
    plugins: [react(), VitePWA({
      registerType: 'autoUpdate',
      manifest: { name, short_name: name.split(' ')[0].slice(0, 12), start_url: '/', display: 'standalone',
        background_color: '#0F1F17', theme_color: '#0F1F17',
        icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] },
      workbox: { navigateFallback: '/index.html' } // online-first: app shell only, no data caching
    })]
  }
})
