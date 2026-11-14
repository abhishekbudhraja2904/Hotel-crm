import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getTheme, setTheme, Theme } from '../lib/theme'
import { useDragReorder } from '../lib/drag'
import { useSettings, saveSetting, FIRST, LAST, DEFAULT_TILES, Tile } from '../lib/settings'
import Catalogue from './Catalogue'
import ExcelCard from './ExcelCard'
import { IndiaMartIntake } from './IndiaMart'
import { CustomerAppContacts, CustomerAppProblems } from './CustomerApp'
import { PackReminderRule, PaymentRules, ClockRules, OfficeNetwork, StaffRules, KitContents, SoldTogether, LockMortis, TempRule } from './SettingsExtra'

type Row = { orig?: string; name: string }
function ListEditor({ title, hint, fixedStart = [], fixedEnd = [], values, onSave }: { title: string; hint?: string; fixedStart?: string[]; fixedEnd?: string[]; values: string[]; onSave: (items: Row[], removed: string[]) => Promise<string | null> }) {
  const mk = (v: string[]): Row[] => v.map((x) => ({ orig: x, name: x }))
  const [rows, setRows] = useState<Row[]>(mk(values)), [add, setAdd] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const key = values.join('|')
  useEffect(() => { setRows(mk(values)) }, [key])
  const dirty = JSON.stringify(rows.map((r) => r.name)) !== JSON.stringify(values)
  const drag = useDragReorder(rows, setRows)
  const edit = (i: number, v: string) => setRows(rows.map((r, k) => (k === i ? { ...r, name: v } : r)))
  const addRow = () => { const v = add.trim(); if (!v) return; setRows([...rows, { name: v }]); setAdd('') }
  async function save() {
    setMsg(''); const names = rows.map((r) => r.name.trim())
    if (names.some((n) => !n)) return setMsg('A name is empty.')
    const all = [...names, ...fixedStart, ...fixedEnd].map((n) => n.toLowerCase())
    if (new Set(all).size !== all.length) return setMsg('Each name must be different.')
    setBusy(true)
    const removed = values.filter((v) => !rows.some((r) => r.orig === v))
    const err = await onSave(rows.map((r) => ({ orig: r.orig, name: r.name.trim() })), removed)
    setBusy(false); setMsg(err ?? 'Saved.')
  }
  return (
    <div className="card"><h3 style={{ margin: 0 }}>{title}</h3>{hint && <p className="muted" style={{ margin: 0 }}>{hint}</p>}
      {fixedStart.map((f) => <div className="setrow fixed" key={f}><span>{f}</span><span className="muted">fixed</span></div>)}
      {rows.map((r, i) => <div className={`setrow${drag.active === i ? ' dragging' : ''}`} key={i} ref={drag.ref(i)}>
        <button type="button" className="grip" aria-label="Hold and drag to reorder" {...drag.handle(i)}>⠿</button><input value={r.name} onChange={(e) => edit(i, e.target.value)} />
        <button type="button" className="link" onClick={() => setRows(rows.filter((_, k) => k !== i))}>Remove</button></div>)}
      {fixedEnd.map((f) => <div className="setrow fixed" key={f}><span>{f}</span><span className="muted">fixed</span></div>)}
      <div className="setrow"><input placeholder="Add new…" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRow()} /><button type="button" onClick={addRow}>Add</button></div>
      {msg && <p className="msg">{msg}</p>}
      <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  )
}

const KIND_HELP: Record<string, string> = { total: 'All inquiries', today: 'Inquiries created today', active: 'Inquiries still open (not Order Confirmed, Lost or On Hold)', due_today: 'Follow-ups due later today', overdue: 'Follow-ups past their time' }
function TileEditor({ tiles, stages, onSave }: { tiles: Tile[]; stages: string[]; onSave: (t: Tile[]) => Promise<string | null> }) {
  const [rows, setRows] = useState<Tile[]>(tiles), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const key = JSON.stringify(tiles)
  useEffect(() => { setRows(tiles) }, [key])
  const dirty = JSON.stringify(rows) !== key
  const drag = useDragReorder(rows, setRows)
  const upd = (i: number, p: Partial<Tile>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...p } : r)))
  const toggle = (i: number, st: string) => { const cur = rows[i].stages ?? []; upd(i, { stages: cur.includes(st) ? cur.filter((x) => x !== st) : [...cur, st] }) }
  async function save() {
    if (rows.some((r) => !r.label.trim())) return setMsg('Every tile needs a name.')
    if (rows.some((r) => r.kind === 'stage' && !(r.stages ?? []).length)) return setMsg('Pick at least one stage for each stage tile.')
    setBusy(true); const e = await onSave(rows.map((r) => ({ ...r, label: r.label.trim() }))); setBusy(false); setMsg(e ?? 'Saved.')
  }
  return (
    <div className="card"><h3 style={{ margin: 0 }}>Dashboard numbers</h3>
      <p className="muted" style={{ margin: 0 }}>The boxes at the top of the Dashboard. Rename, hide, reorder, or add your own count of inquiries in the stages you choose.</p>
      {rows.map((r, i) => <div key={r.id} ref={drag.ref(i)} className={drag.active === i ? 'dragging' : ''} style={{ display: 'grid', gap: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
        <div className="setrow"><button type="button" className="grip" aria-label="Hold and drag to reorder" {...drag.handle(i)}>⠿</button><input value={r.label} onChange={(e) => upd(i, { label: e.target.value })} />
          <button type="button" className="link" onClick={() => setRows(rows.filter((_, k) => k !== i))}>Remove</button></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row' }}><input type="checkbox" style={{ width: 18, height: 18, padding: 0 }} checked={!r.hidden} onChange={(e) => upd(i, { hidden: !e.target.checked })} />Show on Dashboard</label>
        {r.kind !== 'stage' ? <span className="muted">Counts: {KIND_HELP[r.kind]}</span> : <>
          <span className="muted">Counts inquiries in these stages:</span>
          <div className="checks">{stages.map((st) => <label key={st} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'inherit' }}><input type="checkbox" style={{ width: 16, height: 16, padding: 0 }} checked={(r.stages ?? []).includes(st)} onChange={() => toggle(i, st)} />{st}</label>)}</div>
          <label>Time window<select value={r.period ?? 'all'} onChange={(e) => upd(i, { period: e.target.value as any })}><option value="all">All time</option><option value="month">This month (by last change)</option><option value="today">Today (by last change)</option></select></label></>}
      </div>)}
      <div className="bar"><button type="button" onClick={() => setRows([...rows, { id: 't' + Date.now(), label: 'New count', kind: 'stage', stages: [], period: 'all' }])}>+ Add a stage count</button>
        <button type="button" className="link" onClick={() => setRows(DEFAULT_TILES)}>Reset to standard tiles</button></div>
      {msg && <p className="msg">{msg}</p>}
      <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  )
}

export default function Settings({ me }: { me: any }) {
  const qc = useQueryClient(), s = useSettings(), isAdmin = me.role === 'admin', [theme, setT] = useState<Theme>(getTheme())
  const mid = s.stages.filter((x) => x !== FIRST && !LAST.includes(x))
  const done = () => qc.invalidateQueries({ queryKey: ['settings'] })
  async function saveList(key: string, items: Row[]) { const e = await saveSetting(key, items.map((i) => i.name), me.id); done(); return e }
  // Categories: renaming carries the products (and the hotel lock kit) along; a category with products cannot be removed.
  async function saveCats(items: Row[], removed: string[]) {
    if (removed.length) {
      const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true }).in('product_category', removed)
      if (error) return error.message
      if (count) return 'Move the products out of that category first, then remove it.'
    }
    const renamed = items.filter((it) => it.orig && it.orig !== it.name)
    for (const it of renamed) { const { error } = await supabase.rpc('rename_product_category', { p_old: it.orig, p_new: it.name }); if (error) return error.message }
    if (renamed.length && s.kitCategories.length) await saveSetting('kitCategories', s.kitCategories.map((k) => renamed.find((r) => r.orig === k)?.name ?? k), me.id)
    for (const k of ['catalogue-admin', 'catalogue', 'inventory']) qc.invalidateQueries({ queryKey: [k] })
    return saveList('categories', items)
  }
  async function saveStages(items: Row[], removed: string[]) {
    for (const n of removed) {
      const { count, error } = await supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('sales_stage', n)
      if (error) return error.message
      if (count) return `Can't remove "${n}": ${count} inquiries are in it. Move them to another stage first.`
    }
    for (const it of items) if (it.orig && it.orig !== it.name) { // renaming moves existing inquiries along
      const { error } = await supabase.from('inquiries').update({ sales_stage: it.name }).eq('sales_stage', it.orig); if (error) return error.message }
    const renames = items.filter((it) => it.orig && it.orig !== it.name)
    if (renames.length) { const map = Object.fromEntries(renames.map((r) => [r.orig!, r.name])); const t = s.tiles.map((x) => (x.stages ? { ...x, stages: x.stages.map((st) => map[st] ?? st) } : x)); const te = await saveSetting('tiles', t, me.id); if (te) return te }
    const e = await saveSetting('stages', [FIRST, ...items.map((i) => i.name), ...LAST], me.id)
    done(); qc.invalidateQueries({ queryKey: ['inquiries'] }); return e
  }
  const pick = (t: Theme) => { setT(t); setTheme(t) }
  return (
    <section>
      <div className="card"><h3 style={{ margin: 0 }}>Appearance</h3>
        <p className="muted" style={{ margin: 0 }}>Applies on this device only.</p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          {(['light', 'dark', 'auto'] as Theme[]).map((t) => <button key={t} className={theme === t ? 'primary' : ''} onClick={() => pick(t)}>{t === 'auto' ? 'Match device' : t[0].toUpperCase() + t.slice(1)}</button>)}</div></div>
      <div className="card"><h3 style={{ margin: 0 }}>Your account</h3><div className="muted">{me.employee_name} · {me.email} · {me.role}</div></div>
      {(isAdmin || me.role === 'sales') && <ExcelCard me={me} />}
      {isAdmin ? <>
        <h3>Company settings (admin only)</h3>
        <Catalogue meId={me.id} categoryEditor={<ListEditor title="Categories" hint="Add, rename, reorder (drag) or remove categories. Renaming moves its products along. A category can be removed only when it has no products." values={s.categories} onSave={saveCats} />} />
        <PaymentRules me={me} />
        <TempRule me={me} />
        <PackReminderRule me={me} />
        <CustomerAppContacts />
        <CustomerAppProblems />
        <StaffRules me={me} />
        <OfficeNetwork />
        <ClockRules me={me} />
        <KitContents me={me} />
        <SoldTogether me={me} />
        <LockMortis me={me} />
        <IndiaMartIntake me={me} />
        <ListEditor title="Inquiry sources" hint="Where an inquiry came from, e.g. IndiaMART. Renaming does not change old records." values={s.sources} onSave={(i) => saveList('sources', i)} />
        <ListEditor title="Follow-up outcomes" hint="The choices shown when a follow-up is marked Done. Renaming does not change old records." values={s.outcomes} onSave={(i) => saveList('followupOutcomes', i)} />
        <ListEditor title="Reasons an inquiry is lost" hint="The choices shown when someone marks an inquiry Lost. Renaming does not change old records." values={s.lostReasons} onSave={(i) => saveList('lostReasons', i)} />
        <TileEditor tiles={s.tiles} stages={s.stages} onSave={async (t) => { const e = await saveSetting('tiles', t, me.id); done(); return e }} />
        <ListEditor title="Pipeline stages" hint="Renaming moves existing inquiries to the new name. 'Quotation Sent' feeds the dashboard's pending-quotations count. The fixed stages drive built-in behaviour." fixedStart={[FIRST]} fixedEnd={LAST} values={mid} onSave={saveStages} />
      </> : <p className="muted">Company lists (categories, sources, pipeline stages) are managed by the administrator.</p>}
    </section>
  )
}
