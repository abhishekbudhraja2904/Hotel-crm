import { getLang, setLang } from '../lib/i18n'
// Small English / Hindi switch. Changing it reloads the app in the other language (saved on this device).
export default function LangSwitch() {
  const hi = getLang() === 'hi'
  return <button data-no-translate aria-label="Language" onClick={() => setLang(hi ? 'en' : 'hi')} style={{ background: 'none', border: '1px solid var(--line, #cfc6b4)', borderRadius: 8, padding: '2px 8px', fontSize: 13, marginLeft: 'auto' }}>{hi ? 'English' : 'हिन्दी'}</button>
}
