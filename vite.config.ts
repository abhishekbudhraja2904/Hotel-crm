import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: { name: 'Hotel Access CRM', short_name: 'Access CRM', start_url: '/', display: 'standalone',
      background_color: '#ffffff', theme_color: '#1f3a5f',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] },
    workbox: { navigateFallback: '/index.html' } // online-first: app shell only, no data caching
  })]
})
