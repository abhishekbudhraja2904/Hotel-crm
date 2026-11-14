import { ReactNode, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings, saveSetting } from '../lib/settings'
// Admin only: the product catalogue. Everyone else picks from this list.
export default function Catalogue({ categoryEditor, meId }: { categoryEditor?: ReactNode; meId?: string }) {
  const qc = useQueryClient(), { categories } = useSettings(), [edit, setEdit] = useState<any>(null), [msg, setMsg] = useState(''), [showHidden, setShowHidden] = useState(false), [find, setFind] = useState('')
  const [drag, setDrag] = useState<string | null>(null), [over, setOver] = useState<string | null>(null), groupRef = useRef<any[]>([]), allRef = useRef<any[]>([])
  const [openCat, setOpenCat] = useState<string | null>(null), [pickFor, setPickFor] = useState<string | null>(null), [editCats, setEditCats] = useState(false)
  const list = useQuery({ queryKey: ['catalogue-admin'], queryFn: async () => { const { data, error } = await supabase.rpc('catalogue_admin'); if (error) throw error; return data as any[] } })
  const refresh = () => { for (const k of ['catalogue-admin', 'catalogue', 'inventory', 'lowstock', 'products', 'quote-products']) qc.invalidateQueries({ queryKey: [k] }) }
  async function setActive(p: any, on: boolean) { const { error } = await supabase.rpc('set_product_active', { p_id: p.id, p_active: on }); setMsg(error ? error.message : ''); refresh() }
  // Move a product to another category (from the dropdown that opens when its name is pressed).
  async function changeCat(p: any, cat: string) {
    setPickFor(null); if (!cat || cat === p.product_category) return
    const { error } = await supabase.rpc('admin_save_product', { p_id: p.id, p_name: p.product_name, p_cat: cat, p_code: p.product_code ?? '', p_unit: p.unit, p_desc: p.description ?? '', p_low: Number(p.low_stock_level) || 0 })
    setMsg(error ? error.message : `${p.product_name} moved to ${cat}.`); refresh()
  }
  const scrollParent = (el: HTMLElement | null): HTMLElement | Window => { for (let n = el?.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n } return window }
  // Drag a product by its handle (mouse or finger) and drop it where it should go within its category.
  function startDrag(e: React.PointerEvent, p: any) {
    e.preventDefault(); const sp = scrollParent(e.currentTarget as HTMLElement); let y = e.clientY, target: string | null | undefined
    const group = groupRef.current; setDrag(p.id); setOver(null)
    const move = (ev: PointerEvent) => {
      y = ev.clientY
      const row = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-pid]') as HTMLElement | null; if (!row) return
      const i = group.findIndex((x) => x.id === row.dataset.pid); if (i < 0) return
      const r = row.getBoundingClientRect(), before = ev.clientY < r.top + r.height / 2
      target = before ? group[i].id : i + 1 < group.length ? group[i + 1].id : 'END'; setOver(target)
    }
    const tick = setInterval(() => { const h = window.innerHeight, d = y < 90 ? -14 : y > h - 90 ? 14 : 0; if (d) (sp instanceof Window ? window.scrollBy(0, d) : sp.scrollBy(0, d)) }, 16)
    const up = async () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); clearInterval(tick)
      setDrag(null); setOver(null)
      if (target && target !== p.id) {
        const from = group.findIndex((x) => x.id === p.id), to = target === 'END' ? group.length : group.findIndex((x) => x.id === target)
        if (to !== from && to !== from + 1) { // optimistic: show the new order at once
          const ids = allRef.current.map((x) => x.id).filter((x) => x !== p.id); ids.splice(target === 'END' ? ids.length : ids.indexOf(target), 0, p.id)
          qc.setQueryData(['catalogue-admin'], (old: any[] | undefined) => (old ? [...old].sort((a, b) => (a.active === b.active ? ids.indexOf(a.id) - ids.indexOf(b.id) : a.active ? -1 : 1)) : old))
          const { error } = await supabase.rpc('move_product_to', { p_id: p.id, p_before: target === 'END' ? null : target }); setMsg(error ? error.message : ''); refresh()
        }
      }
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  // Drag a whole category by its handle to change the order of the categories (everyone sees this order).
  const [catDrag, setCatDrag] = useState<string | null>(null), [catOver, setCatOver] = useState<string | null>(null)
  function startCatDrag(e: React.PointerEvent, name: string, names: string[]) {
    e.preventDefault(); setOpenCat(null); setCatDrag(name); setCatOver(null); let target: string | null | undefined, y = e.clientY
    const sp = scrollParent(e.currentTarget as HTMLElement)
    const move = (ev: PointerEvent) => {
      y = ev.clientY
      const row = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-cat]') as HTMLElement | null; if (!row) return
      const i = names.indexOf(row.dataset.cat as string); if (i < 0) return
      const r = row.getBoundingClientRect(), before = ev.clientY < r.top + r.height / 2
      target = before ? names[i] : i + 1 < names.length ? names[i + 1] : 'END'; setCatOver(target)
    }
    const tick = setInterval(() => { const h = window.innerHeight, d = y < 90 ? -14 : y > h - 90 ? 14 : 0; if (d) (sp instanceof Window ? window.scrollBy(0, d) : sp.scrollBy(0, d)) }, 16)
    const up = async () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); clearInterval(tick)
      setCatDrag(null); setCatOver(null)
      if (target && target !== name) {
        const rest = names.filter((x) => x !== name); rest.splice(target === 'END' ? rest.length : rest.indexOf(target), 0, name)
        if (rest.join('|') !== names.join('|')) { const err = await saveSetting('categories', rest.filter((x) => categories.includes(x)), meId ?? ''); setMsg(err ?? 'Category order saved.'); qc.invalidateQueries({ queryKey: ['settings'] }); refresh() }
      }
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  async function top(p: any) { const { error } = await supabase.rpc('move_product', { p_id: p.id, p_dir: 'top' }); setMsg(error ? error.message : ''); refresh() }
  const all = (list.data ?? []).filter((p) => p.active), hid = (list.data ?? []).filter((p) => !p.active)
  allRef.current = all
  const q = find.trim().toLowerCase(), found = q ? all.filter((p) => `${p.product_name} ${p.product_code ?? ''} ${p.product_category}`.toLowerCase().includes(q)) : []
  const extra: string[] = [...new Set<string>(all.map((p) => String(p.product_category)))].filter((c) => !categories.includes(c))
  const groups: { name: string; label: string }[] = [...categories.map((c) => ({ name: c, label: c })), ...extra.map((c) => ({ name: c, label: `${c} (not in the category list)` }))]
  const row = (p: any, i: number, n: number, group: any[], draggable: boolean) => <div key={p.id} data-pid={p.id} className="row" style={{ borderTop: over === p.id ? '3px solid #b5532f' : '1px solid var(--line)', borderBottom: over === 'END' && i === n - 1 ? '3px solid #b5532f' : undefined, paddingTop: 6, opacity: drag === p.id ? 0.4 : 1, flexWrap: 'nowrap' }}>
    {draggable && <span role="button" aria-label="Drag to change the order" title="Drag to change the order" onPointerDown={(e) => { groupRef.current = group; startDrag(e, p) }} style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none', fontSize: 22, padding: '0 10px 0 2px', color: 'var(--muted, #8b8f86)' }}>⠿</span>}
    <div style={{ flex: 1, minWidth: 0 }}>
      {pickFor === p.id
        ? <select autoFocus value={p.product_category} onChange={(e) => changeCat(p, e.target.value)} onBlur={() => setPickFor(null)}>{[...new Set([p.product_category, ...categories])].map((c) => <option key={c}>{c}</option>)}</select>
        : <button className="link" style={{ fontWeight: 700, textAlign: 'left' }} title="Press to change the category" onClick={() => setPickFor(p.id)}>{p.product_name} ▾</button>}
      <div className="muted">{q ? `${p.product_category} · ` : ''}{p.product_code ? `${p.product_code} · ` : ''}{p.unit}{Number(p.low_stock_level) > 0 ? ` · alert at ${Number(p.low_stock_level)}` : ''}{p.family ? ` · Group: ${p.family}` : ''}</div></div>
    <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{draggable && <button className="link" onClick={() => top(p)}>Top</button>}<button className="link" onClick={() => setEdit(p)}>Edit</button><button className="link" onClick={() => confirm(`Hide ${p.product_name}?`) && setActive(p, false)}>Hide</button></span></div>
  return <div className="card"><h3 style={{ margin: 0 }}>Product catalogue and categories</h3>
    <p className="muted" style={{ margin: 0 }}>Open a category to see its products. Press a product's name to move it to another category. Drag a category heading by its ⠿ handle to reorder the categories. Drag a product by its ⠿ handle to change the order everyone sees, or press Top to put it first. Hiding a product keeps its history.</p>
    {msg && <p className="msg">{msg}</p>}
    <div className="bar"><button className="primary" onClick={() => setEdit({ product_category: openCat ?? categories[0] })}>+ Add product</button>{categoryEditor && <button onClick={() => setEditCats(!editCats)}>{editCats ? 'Close category editor' : 'Edit categories'}</button>}</div>
    {editCats && categoryEditor}
    <input placeholder="Search the catalogue…" value={find} onChange={(e) => setFind(e.target.value)} />
    {list.isLoading && <p className="empty">Loading…</p>}
    {list.data && !all.length && <p className="empty">No products yet.</p>}
    {q ? <>
      {!found.length && <p className="empty">Nothing found.</p>}
      {found.map((p, i) => row(p, i, found.length, found, false))}
    </> : groups.map((g) => { const items = all.filter((p) => p.product_category === g.name), open = openCat === g.name
      return <div key={g.name} data-cat={g.name} style={{ borderTop: catOver === g.name ? '3px solid #b5532f' : '1px solid var(--line)', borderBottom: catOver === 'END' && g.name === groups[groups.length - 1].name ? '3px solid #b5532f' : undefined, paddingTop: 6, opacity: catDrag === g.name ? 0.4 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>{categories.includes(g.name) && <span role="button" aria-label="Drag to change the category order" title="Drag to change the category order" onPointerDown={(e) => startCatDrag(e, g.name, groups.map((x) => x.name))} style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none', fontSize: 22, padding: '0 10px 0 2px', color: 'var(--muted, #8b8f86)' }}>⠿</span>}
        <button className="link" style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 16 }} onClick={() => { setOpenCat(open ? null : g.name); setPickFor(null) }}>{open ? '▾' : '▸'} {g.label} <span className="muted" style={{ fontWeight: 400 }}>({items.length})</span></button></div>
        {open && <div style={{ display: 'grid', gap: 2, paddingLeft: 6 }}>
          {!items.length && <p className="empty">No products in this category yet.</p>}
          {items.map((p, i) => row(p, i, items.length, items, true))}</div>}
      </div> })}
    {hid.length > 0 && <button className="link" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Hide' : 'Show'} hidden products ({hid.length})</button>}
    {showHidden && hid.map((p) => <div key={p.id} className="row"><span className="muted">{p.product_name} · {p.product_category}</span><button className="link" onClick={() => setActive(p, true)}>Show again</button></div>)}
    {edit && <ProductEditor product={edit.id ? edit : null} startCat={edit.product_category} others={all} categories={categories} onClose={() => setEdit(null)} onDone={refresh} />}
  </div>
}
function ProductEditor({ product, startCat, others, categories, onClose, onDone }: { product: any; startCat?: string; others: any[]; categories: string[]; onClose: () => void; onDone: () => void }) {
  const cats = product && !categories.includes(product.product_category) ? [product.product_category, ...categories] : categories
  const [f, setF] = useState({ name: product?.product_name ?? '', cat: product?.product_category ?? startCat ?? categories[0], code: product?.product_code ?? '', unit: product?.unit ?? 'pcs', desc: product?.description ?? '', low: String(Number(product?.low_stock_level ?? 0) || ''), fam: (product?.family ?? '') as string })
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
