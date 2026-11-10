import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'
// Admin only: the product catalogue. Everyone else picks from this list.
export default function Catalogue() {
  const qc = useQueryClient(), { categories } = useSettings(), [edit, setEdit] = useState<any>(null), [msg, setMsg] = useState(''), [showHidden, setShowHidden] = useState(false), [find, setFind] = useState(''), [drag, setDrag] = useState<string | null>(null), [over, setOver] = useState<string | null>(null), visRef = useRef<any[]>([])
  const list = useQuery({ queryKey: ['catalogue-admin'], queryFn: async () => { const { data, error } = await supabase.rpc('catalogue_admin'); if (error) throw error; return data as any[] } })
  const refresh = () => { for (const k of ['catalogue-admin', 'catalogue', 'inventory', 'lowstock', 'products', 'quote-products']) qc.invalidateQueries({ queryKey: [k] }) }
  async function setActive(p: any, on: boolean) { const { error } = await supabase.rpc('set_product_active', { p_id: p.id, p_active: on }); setMsg(error ? error.message : ''); refresh() }
  const scrollParent = (el: HTMLElement | null): HTMLElement | Window => { for (let n = el?.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n } return window }
  // Drag a product by its handle (mouse or finger) and drop it where it should go.
  function startDrag(e: React.PointerEvent, p: any) {
    e.preventDefault(); const sp = scrollParent(e.currentTarget as HTMLElement); let y = e.clientY, target: string | null | undefined
    setDrag(p.id); setOver(null)
    const move = (ev: PointerEvent) => {
      y = ev.clientY
      const row = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-pid]') as HTMLElement | null; if (!row) return
      const list = visRef.current, i = list.findIndex((x) => x.id === row.dataset.pid); if (i < 0) return
      const r = row.getBoundingClientRect(), before = ev.clientY < r.top + r.height / 2
      target = before ? list[i].id : i + 1 < list.length ? list[i + 1].id : 'END'; setOver(target)
    }
    const tick = setInterval(() => { const h = window.innerHeight, d = y < 90 ? -14 : y > h - 90 ? 14 : 0; if (d) (sp instanceof Window ? window.scrollBy(0, d) : sp.scrollBy(0, d)) }, 16)
    const up = async () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); clearInterval(tick)
      setDrag(null); setOver(null)
      if (target && target !== p.id) {
        const list = visRef.current, from = list.findIndex((x) => x.id === p.id), to = target === 'END' ? list.length : list.findIndex((x) => x.id === target)
        if (to !== from && to !== from + 1) { // optimistic: show the new order at once
          const ids = list.map((x) => x.id).filter((x) => x !== p.id); ids.splice(target === 'END' ? ids.length : ids.indexOf(target), 0, p.id)
          qc.setQueryData(['catalogue-admin'], (old: any[] | undefined) => (old ? [...old].sort((a, b) => (a.active === b.active ? ids.indexOf(a.id) - ids.indexOf(b.id) : a.active ? -1 : 1)) : old))
          const { error } = await supabase.rpc('move_product_to', { p_id: p.id, p_before: target === 'END' ? null : target }); setMsg(error ? error.message : ''); refresh()
        }
      }
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  async function move(p: any, dir: 'top' | 'up' | 'down') { const { error } = await supabase.rpc('move_product', { p_id: p.id, p_dir: dir }); setMsg(error ? error.message : ''); refresh() }
  const all = (list.data ?? []).filter((p) => p.active), vis = find.trim() ? all.filter((p) => `${p.product_name} ${p.product_code ?? ''} ${p.product_category}`.toLowerCase().includes(find.trim().toLowerCase())) : all, hid = (list.data ?? []).filter((p) => !p.active)
  visRef.current = vis
  return <div className="card"><h3 style={{ margin: 0 }}>Product catalogue</h3>
    <p className="muted" style={{ margin: 0 }}>Staff choose products only from this list: in inquiries, quotations and stock. Hiding a product keeps its history. The order here is the order everyone sees: drag a product by the ⠿ handle to move it, or press Top to put it first.</p>
    {msg && <p className="msg">{msg}</p>}
    <button className="primary" onClick={() => setEdit({})}>+ Add product</button>
    <input placeholder="Search the catalogue…" value={find} onChange={(e) => setFind(e.target.value)} />
    {list.isLoading && <p className="empty">Loading…</p>}
    {list.data && !vis.length && <p className="empty">No products yet.</p>}
    {vis.map((p, i) => <div key={p.id} data-pid={p.id} className="row" style={{ borderTop: over === p.id ? '3px solid #b5532f' : '1px solid var(--line)', borderBottom: over === 'END' && i === vis.length - 1 ? '3px solid #b5532f' : undefined, paddingTop: 6, opacity: drag === p.id ? 0.4 : 1, flexWrap: 'nowrap' }}>
      {!find.trim() && <span role="button" aria-label="Drag to change the order" title="Drag to change the order" onPointerDown={(e) => startDrag(e, p)} style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none', fontSize: 22, padding: '0 10px 0 2px', color: 'var(--muted, #8b8f86)' }}>⠿</span>}
      <div style={{ flex: 1, minWidth: 0 }}><b>{p.product_name}</b><div className="muted">{p.product_category}{p.product_code ? ` · ${p.product_code}` : ''} · {p.unit}{Number(p.low_stock_level) > 0 ? ` · alert at ${Number(p.low_stock_level)}` : ''}</div>{p.family && <div className="muted">Group: {p.family}</div>}</div>
      <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{!find.trim() && <><button className="link" onClick={() => move(p, 'top')}>Top</button></>}<button className="link" onClick={() => setEdit(p)}>Edit</button><button className="link" onClick={() => confirm(`Hide ${p.product_name}?`) && setActive(p, false)}>Hide</button></span></div>)}
    {hid.length > 0 && <button className="link" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Hide' : 'Show'} hidden products ({hid.length})</button>}
    {showHidden && hid.map((p) => <div key={p.id} className="row"><span className="muted">{p.product_name}</span><button className="link" onClick={() => setActive(p, true)}>Show again</button></div>)}
    {edit && <ProductEditor product={edit.id ? edit : null} others={all} categories={categories} onClose={() => setEdit(null)} onDone={refresh} />}
  </div>
}
function ProductEditor({ product, others, categories, onClose, onDone }: { product: any; others: any[]; categories: string[]; onClose: () => void; onDone: () => void }) {
  const cats = product && !categories.includes(product.product_category) ? [product.product_category, ...categories] : categories
  const [f, setF] = useState({ name: product?.product_name ?? '', cat: product?.product_category ?? categories[0], code: product?.product_code ?? '', unit: product?.unit ?? 'pcs', desc: product?.description ?? '', low: String(Number(product?.low_stock_level ?? 0) || ''), fam: (product?.family ?? '') as string })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [confirmDel, setConfirmDel] = useState('')
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const r = await supabase.rpc('admin_save_product', { p_id: product?.id ?? null, p_name: f.name, p_cat: f.cat, p_code: f.code, p_unit: f.unit, p_desc: f.desc, p_low: Number(f.low) || 0 })
    const e2 = r.error ? r.error : (f.fam.trim() || product?.family) ? (await supabase.rpc('set_product_family', { p_id: r.data, p_family: f.fam })).error : null
    setBusy(false); if (e2) setErr(e2.message); else { onDone(); onClose() }
  }
  async function del() { const { error } = await supabase.rpc('delete_product', { p_id: product.id }); if (error) setErr(error.message); else { onDone(); onClose() } }
  return <div className="modal"><form className="card" onSubmit={save}>
    <h3 style={{ margin: 0 }}>{product ? 'Edit product' : 'Add product'}</h3>
    <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
    <label>Category<select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
    <label>Product code (optional)<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
    <label>Counted in (for example pcs, sets, cards)<input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
    <label>Description (optional)<input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></label>
    <label>Low-stock alert when the store has this many or fewer (0 = no alert)<input type="number" min="0" value={f.low} onChange={(e) => setF({ ...f, low: e.target.value })} /></label>
    <label>Group (optional, e.g. Kettle or Tray: used for products sold together)<input list="fam-list" value={f.fam} onChange={(e) => setF({ ...f, fam: e.target.value })} /><datalist id="fam-list">{[...new Set(others.map((o) => o.family).filter(Boolean))].map((x) => <option key={x} value={x} />)}</datalist></label>
    {err && <p className="msg">{err}</p>}
    <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="link" onClick={onClose}>Cancel</button>
    {product && <><hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
      <div className="muted">Permanent delete works only for a product that was never used. Type its name to confirm:</div>
      <input value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} placeholder={product.product_name} />
      <button type="button" disabled={confirmDel.trim() !== product.product_name} onClick={del}>Delete forever</button></>}
  </form></div>
}
