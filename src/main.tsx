import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles.css'
import { APP_NAME } from './lib/brand'
import { applyTheme, getTheme } from './lib/theme'
import { initLang } from './lib/i18n'
applyTheme(getTheme())
initLang()
document.title = APP_NAME
const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, refetchOnWindowFocus: true } } })
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={qc}><App /></QueryClientProvider>)
