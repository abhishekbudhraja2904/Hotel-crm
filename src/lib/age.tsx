import { toDate } from './dates'
// How long work has been waiting: 3 days or more turns orange, 5 days or more turns red (until it is finished).
export function ageDays(since?: string | null): number {
  const d = toDate(since); if (!d) return 0
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), t = new Date(), b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  return Math.max(0, Math.round((b - a) / 86400000))
}
export function ageLook(since?: string | null, finished = false) {
  const days = finished ? 0 : ageDays(since), level = days >= 5 ? 'red' : days >= 3 ? 'orange' : ''
  const style: React.CSSProperties = level === 'red' ? { borderLeftColor: '#b3261e', background: 'rgba(179,38,30,0.14)' } : level === 'orange' ? { borderLeftColor: '#d9822b', background: 'rgba(217,130,43,0.14)' } : {}
  return { days, level, style }
}
export function AgeTag({ since, finished }: { since?: string | null; finished?: boolean }) {
  const a = ageLook(since, finished); if (!a.level) return null
  return <span className="pill" style={{ background: a.level === 'red' ? '#b3261e' : '#d9822b', color: '#fff', justifySelf: 'start' }}>{a.days} days waiting</span>
}
