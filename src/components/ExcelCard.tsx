import { useState } from 'react'
import { exportAll, autoOn, setAutoOn, lastDownload, markDownloaded } from '../lib/excel'
import { fmtDateTime } from '../lib/dates'
// Admin and sales: download the data as one Excel file, now or automatically once a week on THIS device.
export default function ExcelCard({ me }: { me: any }) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [auto, setAuto] = useState(autoOn()), [last, setLast] = useState(lastDownload())
  async function go() {
    setBusy(true); setMsg('')
    try { const f = await exportAll(me); markDownloaded(); setLast(new Date().toISOString()); setMsg(`Downloaded ${f}. Look in your Downloads folder.`) } catch (e: any) { setMsg(e.message ?? 'Could not make the file.') }
    setBusy(false)
  }
  return <div className="card"><h3 style={{ margin: 0 }}>Excel download</h3>
    <p className="muted" style={{ margin: 0 }}>{me.role === 'admin' ? 'Everything in the system' : 'Your own inquiries, quotations and orders'} in one Excel file, from the beginning. "Week of" and "This week" columns help you find the latest week.</p>
    <button className="primary" disabled={busy} onClick={go}>{busy ? 'Making the file…' : 'Download Excel now'}</button>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row', color: 'inherit', fontSize: 14 }}>
      <input type="checkbox" style={{ width: 18, height: 18, padding: 0 }} checked={auto} onChange={(e) => { setAutoOn(e.target.checked); setAuto(e.target.checked) }} />Download automatically once a week on this device</label>
    <p className="muted" style={{ margin: 0 }}>This switch belongs to this device only. It downloads the first time you open the app after 7 days. The app cannot download while it is closed.{last ? ` Last download here: ${fmtDateTime(last)}.` : ''}</p>
    {msg && <p className="msg">{msg}</p>}</div>
}
