import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'
import { inr } from '../lib/money'
export const KIT = 'Hotel lock kit'
export type ItemRow = { key: number; cat: string; pid: string; qty: string; price?: string; with?: number; fam?: string; mortis?: string }
let k = 1
export const newRow = (): ItemRow => ({ key: k++, cat: '', pid: '', qty: '', price: '' })
export function useCatalogue() {
  return useQuery({ queryKey: ['catalogue'], staleTime: 30000, queryFn: async () => {
    const { data, error } = await supabase.from('products').select('id,product_name,product_category,unit,family').eq('active', true).is('handle_of', null).order('sort_order').order('product_name'); if (error) throw error; return data as any[] } })
}
// Mortis choices (spare parts) that can be fitted instead of the standard mortis in a lock.
export function useMortisOptions() {
  const { mortis } = useSettings()
  return useQuery({ queryKey: ['mortis-options', mortis.optionIds.join(',')], enabled: mortis.optionIds.length > 0, staleTime: 30000, queryFn: async () => {
    const { data, error } = await supabase.from('spare_parts').select('id,name').in('id', mortis.optionIds).eq('active', true).order('name'); if (error) throw error; return data as any[] } })
}
// Turn saved inquiry lines into editable rows (the category comes from the product).
export function rowsFromItems(items: any[], products: any[]): ItemRow[] {
  return items.map((i) => { const p = products.find((x) => x.id === i.product_id); return { key: k++, cat: p?.product_category ?? '', pid: i.product_id ?? '', qty: i.quantity != null ? String(Number(i.quantity)) : '', price: '', mortis: i.mortis_spare_id ?? '' } })
}
// Rows of: category → product (from the catalogue only) → quantity (→ price, in the quotation).
export default function ItemsEditor({ rows, onChange, showPrice, keepOne }: { rows: ItemRow[]; onChange: (r: ItemRow[]) => void; showPrice?: boolean; keepOne?: boolean }) {
  const cat = useCatalogue(), { categories, kitCategories, soldTogether, mortis } = useSettings(), mortisOpts = useMortisOptions().data ?? [], prods = cat.data ?? []
  const cats = [...new Set([...categories, ...prods.map((p) => p.product_category)])].filter((c) => prods.some((p) => p.product_category === c))
  useEffect(() => { if (cats.length === 1 && rows.some((r) => !r.cat)) onChange(rows.map((r) => (r.cat ? r : { ...r, cat: cats[0] }))) }, [cats.length, rows.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // Picking the kit replaces this row with one row per category of the kit; only the model (and quantity) is left to choose.
  const addKit = (key: number) => onChange(rows.flatMap((r) => (r.key === key ? kitCategories.map((c) => ({ ...newRow(), cat: c })) : [r])))
  const set = (key: number, p: Partial<ItemRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))
  // Products that are always sold together (e.g. Kettle and Tray): picking one adds a row for the other, and only the model is left to choose.
  const pick = (key: number, pid: string) => {
    const r = rows.find((x) => x.key === key)!, prod = prods.find((x) => x.id === pid)
    let next = rows.map((x) => (x.key === key ? { ...x, pid } : x))
    const partners = prod?.family ? soldTogether.filter((p) => p.includes(prod.family)).map((p) => (p[0] === prod.family ? p[1] : p[0])) : []
    for (const fam of partners) {
      const first = prods.find((x) => x.family === fam)
      if (!first || next.some((x) => x.fam === fam || prods.find((y) => y.id === x.pid)?.family === fam)) continue
      const at = next.findIndex((x) => x.key === key)
      next = [...next.slice(0, at + 1), { ...newRow(), cat: first.product_category, qty: r.qty, with: key, fam }, ...next.slice(at + 1)]
    }
    onChange(next)
  }
  const setQty = (key: number, qty: string) => { const r = rows.find((x) => x.key === key)!; onChange(rows.map((x) => (x.key === key ? { ...x, qty } : (x.key === r.with || x.with === key) && (x.qty === '' || x.qty === r.qty) ? { ...x, qty } : x))) }
  const total = rows.reduce((s, r) => s + (Number(r.qty) > 0 && r.price ? Number(r.qty) * Number(r.price) : 0), 0)
  return <div style={{ display: 'grid', gap: 10 }}>
    {cat.isLoading && <p className="muted">Loading products…</p>}
    {cat.data && !prods.length && <p className="warnbox">The product catalogue is empty. The admin adds products in Settings.</p>}
    {rows.map((r, i) => { const inCat = prods.filter((p) => p.product_category === r.cat && (!r.fam || p.family === r.fam)), unit = prods.find((p) => p.id === r.pid)?.unit; return (
      <div className="card itemrow" key={r.key}>
        <div className="row"><b>Item {i + 1}</b>{(rows.length > 1 || !keepOne) && <button type="button" className="link" onClick={() => onChange(rows.filter((x) => x.key !== r.key))}>Remove</button>}</div>
        <label>Category<select value={r.cat} onChange={(e) => e.target.value === KIT ? addKit(r.key) : set(r.key, { cat: e.target.value, pid: '', fam: undefined, mortis: '' })}><option value="">Choose…</option>{kitCategories.length > 0 && <option value={KIT}>{KIT} (adds all its items)</option>}{[...new Set([...(r.cat && !cats.includes(r.cat) ? [r.cat] : []), ...cats])].map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Product<select value={r.pid} disabled={!r.cat} onChange={(e) => pick(r.key, e.target.value)}><option value="">{r.cat ? (inCat.length ? 'Choose…' : 'No product in this category yet') : 'Choose a category first'}</option>{inCat.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}</select></label>
        {r.fam && !r.pid && <div className="muted">Always sold together: choose the {r.fam} model.</div>}
        {mortis.category && r.cat === mortis.category && r.pid && mortisOpts.length > 0 && <label>Mortis<select value={r.mortis ?? ''} onChange={(e) => set(r.key, { mortis: e.target.value })}><option value="">Standard mortis</option>{mortisOpts.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
        <div className="bar">
          <label style={{ flex: 1 }}>Quantity{unit ? ` (${unit})` : ''}<input type="number" inputMode="decimal" min="0" step="any" value={r.qty} onChange={(e) => setQty(r.key, e.target.value)} /></label>
          {showPrice && <label style={{ flex: 1 }}>Price per piece (₹)<input type="number" inputMode="decimal" min="0" step="any" value={r.price ?? ''} onChange={(e) => set(r.key, { price: e.target.value })} /></label>}
        </div>
        {showPrice && Number(r.qty) > 0 && r.price ? <div className="muted">Line total: <b>{inr(Number(r.qty) * Number(r.price))}</b></div> : null}
      </div>) })}
    <button type="button" onClick={() => onChange([...rows, newRow()])}>+ Add another item</button>
    {showPrice && <div className="row"><b>Total quoted</b><b className="bignum" style={{ fontSize: 24 }}>{inr(total)}</b></div>}
  </div>
}
