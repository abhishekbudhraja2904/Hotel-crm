import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { stageColour } from '../lib/stageColour'
import { fmtDateTime } from '../lib/dates'
import InquiryBar, { MoneyMap } from './Progress'
import { TEMP_LOOK } from '../lib/temperature'
// Inquiries as a drag-and-drop board: one column per stage. Each card shows only the inquiry number, the customer's
// name, city and phone, plus the latest note with a box to add a new one. Tapping a card opens everything else in a pop-up.
// Dragging uses pointer events so it works with a mouse and with a finger (on a phone: press and hold a card, then drag).
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const STOP = 'input,textarea,button,a,select,label,[data-nodrag]' // touching these never starts a drag or opens the pop-up
const NO_TEMP = ['Order Confirmed', 'Lost'] // hot / warm / cold only matters while the order is still being won
const RANK: Record<string, number> = { Hot: 0, Warm: 1, Cold: 2, None: 3 }
const ASKS_FIRST = ['Lost', 'Order Confirmed', 'Quotation Sent'] // moving here opens a form first, so the card must not jump ahead

function NoteBox({ r, note, me, editable }: { r: any; note?: any; me: any; editable: boolean }) {
  const qc = useQueryClient(), [text, setText] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  async function add() {
    if (!text.trim() || busy) return
    setBusy(true); setErr('')
    const { error } = await supabase.from('inquiry_notes').insert({ inquiry_id: r.id, body: text.trim(), created_by: me.id })
    setBusy(false); if (error) return setErr(error.message)
    setText(''); qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['notes', 'inquiry', r.id] }); qc.invalidateQueries({ queryKey: ['notes-count'] })
  }
  return <div data-nodrag className="knote">
    {note ? <div><div className="kbody">{note.body}</div><div className="muted" style={{ fontSize: 12 }}>{one(note.author)?.employee_name ?? ''} · {fmtDateTime(note.created_at)}</div></div> : <div className="muted" style={{ fontSize: 13 }}>No note yet</div>}
    {editable && <div className="krow"><input placeholder="Add a note…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} /><button className="primary" disabled={busy || !text.trim()} onClick={add}>Add</button></div>}
    {err && <div className="msg" style={{ fontSize: 12 }}>{err}</div>}
  </div>
}
function CardBody({ r, note, me, editable, temp, money, stages }: { r: any; note?: any; me: any; editable: boolean; temp: string; money?: MoneyMap; stages: string[] }) {
  const c = one(r.customers), L = TEMP_LOOK[temp]
  return <>
    <b>{L ? `${L.icon} ` : ''}{r.inquiry_number}</b>
    <b style={{ fontSize: 16 }}>{c?.customer_name ?? 'Customer'}</b>
    {c?.city && <div className="muted">📍 {c.city}</div>}
    {c?.phone_number && <a href={`tel:${c.phone_number}`} style={{ fontSize: 14 }}>📞 {c.phone_number}</a>}
    {r.sales_stage === 'Order Confirmed' && <InquiryBar r={r} stages={stages} money={money} />}
    <NoteBox r={r} note={note} me={me} editable={editable} />
  </>
}
export default function InquiryBoard({ rows, columns, allStages, me, notes, money, temp, version, onMove, onOpen }: { rows: any[]; columns: string[]; allStages: string[]; me: any; notes?: Map<string, any>; money?: MoneyMap; temp: (r: any) => string; version: number; onMove: (r: any, stage: string) => void; onOpen: (r: any) => void }) {
  const [ovr, setOvr] = useState<Record<string, string>>({}), [drag, setDrag] = useState<any>(null), [over, setOver] = useState('')
  const latest = useRef<any>({})
  const w = useRef({ move: (e: PointerEvent) => latest.current.onMove(e), up: (e: PointerEvent) => latest.current.onUp(e), cancel: () => latest.current.onCancel() }).current // fixed identities so the listeners can be removed
  const g = useRef<any>(null), boardRef = useRef<HTMLDivElement>(null), raf = useRef(0)
  useEffect(() => setOvr({}), [version]) // fresh data from the server replaces any "moved ahead of time" cards
  const eff = (r: any) => ovr[r.id] ?? r.sales_stage
  const tOf = (r: any, s: string) => (NO_TEMP.includes(s) ? '' : temp(r))
  // Inside a column: hottest first, then warm, then cold, then no date; the soonest needed-by date first within each.
  const sorted = (list: any[], s: string) => NO_TEMP.includes(s) ? list : list.map((r, i) => [r, i] as const).sort((a, b) => (RANK[temp(a[0])] ?? 3) - (RANK[temp(b[0])] ?? 3) || (a[0].needed_by ?? '9999').localeCompare(b[0].needed_by ?? '9999') || a[1] - b[1]).map((x) => x[0])
  const hit = (x: number, y: number) => { const el = document.elementsFromPoint(x, y).find((n) => (n as HTMLElement).dataset?.stage !== undefined) as HTMLElement | undefined; const s = el?.dataset.stage ?? ''; if (g.current) g.current.over = s; setOver(s) }
  const stop = () => { clearTimeout(g.current?.timer); cancelAnimationFrame(raf.current); window.removeEventListener('pointermove', w.move); window.removeEventListener('pointerup', w.up); window.removeEventListener('pointercancel', w.cancel); g.current = null; setDrag(null); setOver('') }
  const begin = () => {
    const s = g.current; if (!s || s.active) return; s.active = true; navigator.vibrate?.(12)
    setDrag({ r: s.r, x: s.x, y: s.y, dx: s.dx, dy: s.dy, w: s.w }); hit(s.x, s.y)
    const tick = () => { const q = g.current; if (!q?.active) return
      const b = boardRef.current, rc = b?.getBoundingClientRect()
      if (b && rc) { if (q.x < rc.left + 60) b.scrollLeft -= 14; else if (q.x > rc.right - 60) b.scrollLeft += 14 }
      if (q.y < 90) window.scrollBy(0, -14); else if (q.y > window.innerHeight - 90) window.scrollBy(0, 14)
      hit(q.x, q.y); raf.current = requestAnimationFrame(tick) }
    raf.current = requestAnimationFrame(tick)
  }
  const pMove = (e: PointerEvent) => { const s = g.current; if (!s || e.pointerId !== s.id) return
    s.x = e.clientX; s.y = e.clientY
    if (!s.active) { const d = Math.hypot(e.clientX - s.x0, e.clientY - s.y0)
      if (s.touch) { if (d > 8) stop() } // a finger that moves before the hold is a scroll, not a drag
      else if (d > 5) begin(); return }
    setDrag((d: any) => d && { ...d, x: e.clientX, y: e.clientY }) }
  const pUp = (e: PointerEvent) => { const s = g.current; if (!s || e.pointerId !== s.id) return
    const { r, active, over: to } = s; stop()
    if (!active) return onOpen(r) // a tap: open the details
    if (to && to !== eff(r)) { if (!ASKS_FIRST.includes(to)) setOvr((o) => ({ ...o, [r.id]: to })); onMove(r, to) } }
  const pCancel = () => stop()
  latest.current = { onMove: pMove, onUp: pUp, onCancel: pCancel }
  useEffect(() => { const f = (e: TouchEvent) => { if (g.current?.active) e.preventDefault() } // no page scrolling while a card is being dragged
    window.addEventListener('touchmove', f, { passive: false }); return () => { window.removeEventListener('touchmove', f); cancelAnimationFrame(raf.current) } }, [])
  function down(e: React.PointerEvent, r: any) {
    if (g.current || (e.pointerType === 'mouse' && e.button !== 0) || (e.target as HTMLElement).closest(STOP)) return
    const rc = (e.currentTarget as HTMLElement).getBoundingClientRect()
    g.current = { r, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dx: e.clientX - rc.left, dy: e.clientY - rc.top, w: rc.width, active: false, touch: e.pointerType !== 'mouse', over: '', timer: 0 }
    if (g.current.touch) g.current.timer = setTimeout(begin, 230)
    window.addEventListener('pointermove', w.move); window.addEventListener('pointerup', w.up); window.addEventListener('pointercancel', w.cancel)
  }
  return <>
    <div className="muted" style={{ fontSize: 13, margin: '2px 0 6px' }}>🔥 Hot · 🌤 Warm · ❄️ Cold, by the date the customer needs it. Hottest first in each column.</div>
    <div className="kboard" ref={boardRef}>
      {columns.map((s) => { const list = sorted(rows.filter((r) => eff(r) === s), s)
        return <div key={s} data-stage={s} className={`kcol${over === s ? ' over' : ''}`} style={{ borderTopColor: stageColour(s, allStages) }}>
          <div className="row"><b>{s}</b><span className="pill">{list.length}</span></div>
          {list.map((r) => <div key={r.id} className={`kcard${tOf(r, s) ? ' kt-' + tOf(r, s) : ''}${drag?.r.id === r.id ? ' dragging' : ''}`} style={tOf(r, s) ? undefined : { borderLeftColor: stageColour(s, allStages) }} onPointerDown={(e) => down(e, r)} onContextMenu={(e) => { if (!(e.target as HTMLElement).closest(STOP)) e.preventDefault() }}>
            <CardBody r={r} note={notes?.get(r.id)} me={me} editable temp={tOf(r, s)} money={money} stages={allStages} />
          </div>)}
          {!list.length && <div className="muted kempty">Drop here</div>}
        </div> })}
    </div>
    {drag && <div className={`kghost${tOf(drag.r, eff(drag.r)) ? ' kt-' + tOf(drag.r, eff(drag.r)) : ''}`} style={{ width: drag.w, transform: `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px) rotate(2deg)` }}><CardBody r={drag.r} note={notes?.get(drag.r.id)} me={me} editable={false} temp={tOf(drag.r, eff(drag.r))} money={money} stages={allStages} /></div>}
  </>
}
