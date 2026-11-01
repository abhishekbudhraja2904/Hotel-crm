import { useRef, useState } from 'react'
// Drag-to-reorder for a list: press and hold the grip, drag up or down, let go. Works with mouse and touch (no library).
export function useDragReorder<T>(items: T[], setItems: (n: T[]) => void) {
  const rows = useRef<(HTMLElement | null)[]>([]), latest = useRef(items), [active, setActive] = useState<number | null>(null)
  latest.current = items
  const ref = (i: number) => (el: HTMLElement | null) => { rows.current[i] = el }
  const handle = (i: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== undefined && e.button > 0) return
      e.preventDefault()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
      let cur = i; setActive(i); document.body.style.userSelect = 'none'
      const move = (ev: PointerEvent) => {
        let target = cur
        rows.current.forEach((el, k) => { if (!el) return; const r = el.getBoundingClientRect(); if (ev.clientY > r.top && ev.clientY < r.bottom) target = k })
        if (target !== cur && target < latest.current.length) {
          const n = [...latest.current]; const [x] = n.splice(cur, 1); n.splice(target, 0, x)
          latest.current = n; cur = target; setItems(n); setActive(cur)
        }
      }
      const up = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
        document.body.style.userSelect = ''; setActive(null)
      }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    }
  })
  return { active, ref, handle }
}
