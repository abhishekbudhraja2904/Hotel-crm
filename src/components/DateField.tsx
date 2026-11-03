import { useEffect, useRef, useState } from 'react'
import { fmtDate, isoDate, toDate } from '../lib/dates'
// A date box you can type into (DD/MM/YYYY) with a calendar button beside it. Value in and out is YYYY-MM-DD.
export default function DateField({ value, onChange, ariaLabel, min }: { value: string; onChange: (iso: string) => void; ariaLabel?: string; min?: string }) {
  const [txt, setTxt] = useState(fmtDate(value)), ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setTxt(fmtDate(value)) }, [value])
  const type = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8)
    let o = d.slice(0, 2); if (d.length > 2) o += '/' + d.slice(2, 4); if (d.length > 4) o += '/' + d.slice(4)
    setTxt(o)
    if (d.length === 8) {
      const dd = +d.slice(0, 2), mm = +d.slice(2, 4), yy = +d.slice(4), dt = new Date(yy, mm - 1, dd)
      if (dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd) onChange(isoDate(dt))
    } else if (!d.length) onChange('')
  }
  const open = () => { const r = ref.current; if (!r) return; try { (r as any).showPicker() } catch { r.focus(); r.click() } }
  return (
    <span className="datef">
      <input inputMode="numeric" placeholder="DD/MM/YYYY" aria-label={ariaLabel} value={txt} onChange={(e) => type(e.target.value)} onBlur={() => setTxt(fmtDate(value))} />
      <button type="button" className="calbtn" aria-label="Open calendar" onClick={open}>📅</button>
      <input ref={ref} type="date" className="hiddendate" tabIndex={-1} aria-hidden="true" value={value} min={min} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </span>
  )
}
// Date + 12-hour time. Value in and out is YYYY-MM-DDTHH:mm.
export function DateTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const d = toDate(value) ?? new Date(), date = isoDate(d), h = d.getHours(), h12 = h % 12 || 12, mi = Math.round(d.getMinutes() / 5) * 5 % 60, pm = h >= 12
  const p = (n: number) => String(n).padStart(2, '0')
  const set = (dt: string, hh12: number, mm: number, isPm: boolean) => onChange(`${dt}T${p((hh12 % 12) + (isPm ? 12 : 0))}:${p(mm)}`)
  return (
    <div className="dtf">
      <DateField value={date} onChange={(v) => v && set(v, h12, mi, pm)} ariaLabel="Date" />
      <span className="timef">
        <select aria-label="Hour" value={h12} onChange={(e) => set(date, +e.target.value, mi, pm)}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select>
        <select aria-label="Minute" value={mi} onChange={(e) => set(date, h12, +e.target.value, pm)}>{Array.from({ length: 12 }, (_, i) => i * 5).map((n) => <option key={n} value={n}>{p(n)}</option>)}</select>
        <select aria-label="am or pm" value={pm ? 'pm' : 'am'} onChange={(e) => set(date, h12, mi, e.target.value === 'pm')}><option value="am">am</option><option value="pm">pm</option></select>
      </span>
    </div>
  )
}
