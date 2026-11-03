import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { APP_NAME } from '../lib/brand'
// For people the admin marked "must clock in on office network".
function useClockIn() {
  const qc = useQueryClient(), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  async function go() { setBusy(true); setMsg(''); const { error } = await supabase.rpc('clock_in'); setBusy(false); if (error) setMsg(error.message); qc.invalidateQueries({ queryKey: ['clock'] }); qc.invalidateQueries({ queryKey: ['attendance'] }) }
  return { msg, busy, go }
}
const hint = (s: any) => (!s?.configured ? 'The office network has not been set up yet. Ask the admin.' : !s?.network_ok ? 'You are not on the office Wi-Fi. Connect to it, then press Clock in.' : '')
// First screen after sign-in.
export function ClockGate({ me, status }: { me: any; status: any }) {
  const { msg, busy, go } = useClockIn(), h = new Date().getHours()
  return <div className="card login" style={{ maxWidth: 420 }}>
    <h2 style={{ margin: 0 }}>{h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, {me.employee_name.split(' ')[0]}.</h2>
    <p className="muted" style={{ margin: 0 }}>Clock in to start work in {APP_NAME}.</p>
    {hint(status) && <p className="warnbox">{hint(status)}</p>}
    {msg && <p className="msg">{msg}</p>}
    <button className="primary bigbtn" disabled={busy} onClick={go}>{busy ? 'Checking…' : 'Clock in'}</button>
    <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
}
// Shown above the greyed-out app after clocking out.
export function LockBar({ status }: { status: any }) {
  const { msg, busy, go } = useClockIn()
  return <div className="lockbar"><span><b>You are clocked out.</b> You can look around but not change anything.{hint(status) ? ' ' + hint(status) : ''}{msg ? ' ' + msg : ''}</span><button className="primary" disabled={busy} onClick={go}>{busy ? 'Checking…' : 'Clock in'}</button></div>
}
