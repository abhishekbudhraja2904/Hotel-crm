// One place for how dates and times look: DD/MM/YYYY and 12-hour time with am/pm.
const p = (n: number) => String(n).padStart(2, '0')
export function toDate(s: string | Date | null | undefined): Date | null {
  if (!s) return null
  const d = s instanceof Date ? s : new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s)
  return isNaN(+d) ? null : d
}
export const fmtDate = (s: string | Date | null | undefined) => { const d = toDate(s); return d ? `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}` : '' }
export const fmtTime = (s: string | Date | null | undefined) => { const d = toDate(s); if (!d) return ''; const h = d.getHours(); return `${h % 12 || 12}:${p(d.getMinutes())} ${h < 12 ? 'am' : 'pm'}` }
export const fmtDateTime = (s: string | Date | null | undefined) => { const d = toDate(s); return d ? `${fmtDate(d)}, ${fmtTime(d)}` : '' }
export const isoDate = (d: Date = new Date()) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
export const isoLocal = (d: Date) => `${isoDate(d)}T${p(d.getHours())}:${p(d.getMinutes())}`
// Monday of the week a date falls in (used by the Excel download)
export const weekOf = (s: string | Date | null | undefined) => { const d = toDate(s); if (!d) return ''; const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); return fmtDate(m) }
export const isThisWeek = (s: string | Date | null | undefined) => weekOf(s) !== '' && weekOf(s) === weekOf(new Date())
