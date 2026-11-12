import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/dates'
// Shrinks a picture to at most 1400px wide JPEG so posts load fast on phones.
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img: HTMLImageElement = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Could not read that picture')); i.src = url })
    const k = Math.min(1, 1400 / img.width), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('Could not prepare the picture'))), 'image/jpeg', 0.85))
  } finally { URL.revokeObjectURL(url) }
}
const pub = (p: string) => supabase.storage.from('broadcasts').getPublicUrl(p).data.publicUrl
// Admin and sales: post a designed picture + message to every customer's app.
export default function Broadcast({ me }: { me: any }) {
  const qc = useQueryClient(), [title, setTitle] = useState(''), [caption, setCaption] = useState(''), [until, setUntil] = useState(''), [file, setFile] = useState<File | null>(null), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const list = useQuery({ queryKey: ['broadcasts'], queryFn: async () => { const { data, error } = await supabase.from('broadcasts').select('id,title,caption,image_path,show_until,visible,created_by,created_at,by:employees!created_by(employee_name)').order('created_at', { ascending: false }); if (error) throw error; return data as any[] } })
  const preview = file ? URL.createObjectURL(file) : ''
  async function post() {
    setMsg(''); if (!title.trim()) return setMsg('Give the post a title.'); if (!file && !caption.trim()) return setMsg('Add a picture or a message.')
    setBusy(true)
    try {
      let path: string | null = null
      if (file) { const blob = await shrink(file); path = `${crypto.randomUUID()}.jpg`; const up = await supabase.storage.from('broadcasts').upload(path, blob, { contentType: 'image/jpeg' }); if (up.error) throw up.error }
      const { error } = await supabase.from('broadcasts').insert({ title: title.trim(), caption: caption.trim() || null, image_path: path, show_until: until || null, created_by: me.id })
      if (error) throw error
      setTitle(''); setCaption(''); setUntil(''); setFile(null); setMsg('Posted. Customers will see it in the app.'); qc.invalidateQueries({ queryKey: ['broadcasts'] })
    } catch (e: any) { setMsg(e.message ?? 'Could not post') }
    setBusy(false)
  }
  async function toggle(b: any) { const { error } = await supabase.from('broadcasts').update({ visible: !b.visible }).eq('id', b.id); if (error) setMsg(error.message); qc.invalidateQueries({ queryKey: ['broadcasts'] }) }
  async function del(b: any) {
    if (!confirm(`Delete "${b.title}" for good?`)) return
    const { error } = await supabase.from('broadcasts').delete().eq('id', b.id); if (error) return setMsg(error.message)
    if (b.image_path) await supabase.storage.from('broadcasts').remove([b.image_path]); qc.invalidateQueries({ queryKey: ['broadcasts'] })
  }
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div>
      <div className="card"><h3 style={{ margin: 0 }}>New broadcast</h3>
        <p className="muted" style={{ margin: 0 }}>Shown to all customers in the OFORTT app: festival greetings, offers, notices.</p>
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Happy Diwali" /></label>
        <label>Message (optional)<textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} /></label>
        <label>Picture (your designed post)<input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        {preview && <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, objectFit: 'contain' }} />}
        <label>Show until (optional)<input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
        {msg && <p className="msg">{msg}</p>}
        <button className="primary" disabled={busy} onClick={post}>{busy ? 'Posting…' : 'Post to all customers'}</button>
      </div>
      <h3>Posted</h3>
      {list.isLoading && <p className="muted">Loading…</p>}
      {list.isError && <p className="msg">Broadcast isn't set up yet. Run the new SQL in Supabase first.</p>}
      {list.data?.length === 0 && <p className="muted">Nothing posted yet.</p>}
      {list.data?.map((b) => { const ended = b.show_until && b.show_until < today; const mine = me.role === 'admin' || b.created_by === me.id
        return <div className="card" key={b.id}>
          <div className="row"><b>{b.title}</b><span className={`pill${b.visible && !ended ? '' : ' Medium'}`}>{ended ? 'Ended' : b.visible ? 'Live' : 'Hidden'}</span></div>
          {b.image_path && <img src={pub(b.image_path)} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, objectFit: 'contain' }} />}
          {b.caption && <div>{b.caption}</div>}
          <div className="muted">{fmtDate(b.created_at)} · {b.by?.employee_name ?? ''}{b.show_until ? ` · until ${fmtDate(b.show_until)}` : ''}</div>
          {mine && <div className="bar"><button onClick={() => toggle(b)}>{b.visible ? 'Hide from customers' : 'Show again'}</button><button className="link" onClick={() => del(b)}>Delete</button></div>}
        </div> })}
    </div>
  )
}
