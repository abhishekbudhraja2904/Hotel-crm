export type Theme = 'light' | 'dark' | 'auto'
export const getTheme = (): Theme => { try { return (localStorage.getItem('theme') as Theme) || 'light' } catch { return 'light' } }
export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}
export function setTheme(t: Theme) { try { localStorage.setItem('theme', t) } catch {} applyTheme(t) } // device-only preference, not business data
