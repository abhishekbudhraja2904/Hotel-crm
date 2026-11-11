import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/dates'

// Festive greeting designs. The customer app has the same list (keep them in step).
export const FESTIVALS: Record<string, { label: string; title: string; caption: string; bg: string; accent: string }> = {
  diwali:       { label: 'Diwali',          title: 'Happy Diwali',          caption: 'May every door open to light and luck.',       bg: '#0E3A94', accent: '#FFD43B' },
  dhanteras:    { label: 'Dhanteras',       title: 'Shubh Dhanteras',       caption: 'Wishing you wealth, health and safe doors.',   bg: '#7A1E3A', accent: '#FFD43B' },
  holi:         { label: 'Holi',            title: 'Happy Holi',            caption: 'Wishing you a colourful season.',              bg: '#5B34B5', accent: '#FFB3D1' },
  christmas:    { label: 'Christmas',       title: 'Merry Christmas',       caption: 'Here’s to a full house all season.',           bg: '#063D2C', accent: '#9BE7C4' },
  new_year:     { label: 'New Year',        title: 'Happy New Year',        caption: 'Thank you for trusting OFORTT this year.',      bg: '#223150', accent: '#7CC062' },
  independence: { label: 'Independence Day', title: 'Happy Independence Day', caption: 'Proud to keep India’s doors secure.',       bg: '#0B5E3B', accent: '#FF9933' },
  generic:      { label: 'Other / custom',  title: 'Warm wishes',           caption: 'From all of us at OFORTT.',                    bg: '#223150', accent: '#7CC062' },
}
const BUTTONS: Record<string, string> = { none: 'No button', call: 'Call us', whatsapp: 'WhatsApp us' }
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)
const plus = (d: string, n: number) => new Date(new Date(d).getTime() + n * 864e5).toISOString().slice(0, 10)
const publicUrl = (path: string) => supabase.storage.from('broadcasts').getPublicUrl(path).data.publicUrl

// Shrink a photo to max 1080 px wide JPEG (an Instagram post becomes ~150–300 KB)
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 1080 / img.width)
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read the picture'))), 'image/jpeg', 0.85))
}

// Admin page "Customer app": broadcasts (contacts + problem lists stay in Settings)
export default function CustomerAppAdmin({ me }: { me: any }) {
  const list = useQuery({ queryKey: ['broadcasts'], queryFn: async () => { const { data, error } = await supabase.rpc('staff_broadcasts'); if (error) throw error; return (data ?? []) as any[] } })
  const [edit, setEdit] = useState<any>(null), [msg, setMsg] = useState('')

  async function remove(b: any) {
    if (!confirm('Delete this broadcast? Customers stop seeing it right away.')) return
    const { data: path, error } = await supabase.rpc('staff_delete_broadcast', { p_id: b.id })
    if (error) return setMsg(error.message)
    if (path) await supabase.storage.from('broadcasts').remove([path as string])
    setMsg('Deleted.'); list.refetch()
  }

  return (
    <div className="stack" style={{ display: 'grid', gap: 14 }}>
      <div className="card">
        <div className="row"><h2 style={{ margin: 0 }}>Broadcast to customers</h2>
          <button className="primary" onClick={() => setEdit({ kind: 'post', button: 'call', starts_on: today(), ends_on: plus(today(), 3) })}>+ New</button></div>
        <p className="muted" style={{ margin: 0 }}>Shows at the top of Home in the OFORTT customer app, between the dates you choose. Post your team's Instagram design, or an automatic festive greeting with each customer's own name.</p>
        {msg && <p className="msg">{msg}</p>}
      </div>

      {edit && <Editor me={me} initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setMsg('Saved. Customers see it next time they open the app.'); list.refetch() }} />}

      {list.isLoading && <p>Loading…</p>}
      {list.error && <p className="msg">{(list.error as any).message}</p>}
      {list.data?.length === 0 && <p className="muted">Nothing broadcast yet.</p>}
      {list.data?.map((b) => <div className="card" key={b.id} style={{ opacity: b.state === 'ended' ? 0.6 : 1 }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 96, flex: 'none' }}>{b.kind === 'post'
            ? <img src={publicUrl(b.image_path)} alt="" style={{ width: 96, borderRadius: 8, display: 'block' }} />
            : <div style={{ width: 96, height: 60, borderRadius: 8, background: FESTIVALS[b.festival]?.bg ?? '#223150' }} />}</div>
          <div style={{ flex: 1 }}>
            <b>{b.kind === 'post' ? (b.caption || 'Team post') : (b.title || FESTIVALS[b.festival]?.title)}</b>
            <div className="muted">{b.kind === 'post' ? 'Team post' : `Automatic greeting · ${FESTIVALS[b.festival]?.label ?? 'Custom'}`} · {fmtDate(b.starts_on)} → {fmtDate(b.ends_on)}</div>
            <div className="muted">Button: {BUTTONS[b.button]}{b.created_by ? ` · by ${b.created_by}` : ''}</div>
          </div>
          <span className="pill">{b.state === 'live' ? 'Live' : b.state === 'scheduled' ? 'Scheduled' : 'Ended'}</span>
        </div>
        <div className="bar"><button className="link" onClick={() => setEdit(b)}>Edit</button><button className="link" style={{ color: '#9b3b30' }} onClick={() => remove(b)}>Delete</button></div>
      </div>)}

      <p className="muted">WhatsApp contacts and the problem lists customers pick from are in <b>Settings</b>.</p>
    </div>
  )
}

function Editor({ me, initial, onClose, onSaved }: { me: any; initial: any; onClose: () => void; onSaved: () => void }) {
  const [b, setB] = useState<any>({ ...initial })
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState<string>(initial.image_path ? publicUrl(initial.image_path) : '')
  const [busy, setBusy] = useState(''), [err, setErr] = useState('')
  const set = (p: any) => setB((x: any) => ({ ...x, ...p }))
  useEffect(() => { if (b.kind === 'greeting' && !b.festival) { const f = FESTIVALS.diwali; set({ festival: 'diwali', title: f.title, caption: f.caption }) } }, [b.kind])
  useEffect(() => { if (!file) return; const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u) }, [file])
  const fest = FESTIVALS[b.festival] ?? FESTIVALS.generic

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    try {
      let path = b.kind === 'post' ? b.image_path : null
      if (b.kind === 'post' && file) {
        setBusy('Uploading picture…')
        const blob = await shrink(file)
        path = `${me.org_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        const { error } = await supabase.storage.from('broadcasts').upload(path, blob, { contentType: 'image/jpeg' })
        if (error) throw new Error('Upload failed: ' + error.message)
      }
      if (b.kind === 'post' && !path) throw new Error('Add the picture first.')
      setBusy('Saving…')
      const { error } = await supabase.rpc('staff_save_broadcast', {
        p_id: b.id ?? null, p_kind: b.kind, p_festival: b.kind === 'greeting' ? b.festival : null, p_title: b.kind === 'greeting' ? b.title : null,
        p_caption: b.caption ?? '', p_image_path: path, p_button: b.button, p_starts: b.starts_on, p_ends: b.ends_on,
      })
      if (error) throw new Error(error.message)
      if (b.kind === 'post' && file && initial.image_path && initial.image_path !== path) await supabase.storage.from('broadcasts').remove([initial.image_path])
      onSaved()
    } catch (x: any) { setErr(x.message) } finally { setBusy('') }
  }

  return (
    <form className="card" onSubmit={save} style={{ display: 'grid', gap: 10 }}>
      <div className="row"><h3 style={{ margin: 0 }}>{b.id ? 'Edit broadcast' : 'New broadcast'}</h3><button type="button" className="link" onClick={onClose}>Cancel</button></div>
      {!b.id && <div className="bar">
        <button type="button" className={b.kind === 'post' ? 'primary' : ''} onClick={() => set({ kind: 'post' })}>Team post (picture)</button>
        <button type="button" className={b.kind === 'greeting' ? 'primary' : ''} onClick={() => set({ kind: 'greeting' })}>Festive greeting with customer's name</button>
      </div>}

      {b.kind === 'post' ? <>
        <label>Picture (same image as Instagram is fine)
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        {preview && <img src={preview} alt="Preview" style={{ maxWidth: 320, width: '100%', borderRadius: 12 }} />}
        <label>Caption under the picture (optional)<input value={b.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Shubh Dhanteras from Team OFORTT" /></label>
      </> : <>
        <label>Festival
          <select value={b.festival ?? 'diwali'} onChange={(e) => { const f = FESTIVALS[e.target.value]; set({ festival: e.target.value, title: f.title, caption: f.caption }) }}>
            {Object.entries(FESTIVALS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </select></label>
        <label>Headline (the customer's name is added after it)<input value={b.title ?? ''} onChange={(e) => set({ title: e.target.value })} /></label>
        <label>Message<input value={b.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} /></label>
        <div style={{ background: fest.bg, color: '#fff', borderRadius: 16, padding: 18, maxWidth: 340 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: fest.accent }}>FESTIVE GREETINGS</div>
          <div style={{ fontSize: 21, fontWeight: 700, marginTop: 6 }}>{b.title || fest.title}, Hotel Sunrise!</div>
          <div style={{ fontSize: 13, marginTop: 6, opacity: 0.9 }}>{b.caption} – Team OFORTT</div>
        </div>
        <div className="muted">Preview: each customer sees their own name in place of "Hotel Sunrise".</div>
      </>}

      <label>Button
        <select value={b.button} onChange={(e) => set({ button: e.target.value })}>
          {Object.entries(BUTTONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select></label>
      <div className="muted" style={{ marginTop: -6 }}>Call and WhatsApp go to each customer's own OFORTT contact.</div>
      <div className="bar">
        <label style={{ flex: 1 }}>Show from<input type="date" value={b.starts_on} onChange={(e) => set({ starts_on: e.target.value })} /></label>
        <label style={{ flex: 1 }}>Till (removed after this day)<input type="date" value={b.ends_on} onChange={(e) => set({ ends_on: e.target.value })} /></label>
      </div>
      {err && <p className="msg">{err}</p>}
      <button className="primary" disabled={!!busy}>{busy || (b.id ? 'Save changes' : 'Broadcast')}</button>
    </form>
  )
}
