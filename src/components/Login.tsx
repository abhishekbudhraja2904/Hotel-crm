import { useState } from 'react'
import { supabase } from '../lib/supabase'
export default function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [msg, setMsg] = useState('')
  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMsg(error.message)
  }
  async function reset() {
    if (!email) return setMsg('Enter your email first.')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin })
    setMsg(error ? error.message : 'Password reset link sent to your email.')
  }
  return (
    <form className="card login" onSubmit={signIn}>
      <h1>Hotel Access CRM</h1>
      <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="primary">Sign in</button>
      <button type="button" className="link" onClick={reset}>Forgot password?</button>
      {msg && <p className="msg">{msg}</p>}
    </form>
  )
}
