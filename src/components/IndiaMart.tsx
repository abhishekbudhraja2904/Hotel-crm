import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings, saveSetting } from '../lib/settings'
// Admin-only: connects the company Gmail to Hermora so IndiaMART lead emails become inquiries automatically.
const PARSER = String.raw`function parseLead(text) {
  // Only read the IndiaMART part: skip the forwarder's signature above it and the IndiaMART footer below it.
  var a = text.search(/Buyer.?s Contact Details/i); if (a < 0) a = text.search(/Buy ?Lead through IndiaMART/i); if (a >= 0) text = text.slice(a);
  var z = text.search(/Reply To This Message/i); if (z > 0) text = text.slice(0, z);
  var lines = text.replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(function (l) { return l; });
  var labels = { quantity: 'quantity', application: 'application', 'access method': 'access_method', 'buyer filled details': 'buyer_filled', 'probable order value': 'order_value', 'probable requirement type': 'requirement_type', email: 'email', company: 'company' };
  var d = {}, used = {};
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/^(Quantity|Application|Access Method|Buyer Filled Details|Probable Order Value|Probable Requirement Type|Email|Company)\s*[:\-]?\s*(.*)$/i);
    if (m) {
      var key = labels[m[1].toLowerCase()], val = m[2];
      if (!val && lines[i + 1] && !/^(Quantity|Application|Access Method|Buyer Filled|Probable)/i.test(lines[i + 1])) { val = lines[i + 1]; used[i + 1] = 1; }
      if (val && !d[key]) d[key] = val;
      used[i] = 1;
    }
  }
  var pi = -1;
  for (i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    var pm = lines[i].match(/(?:\+\s*91[\s-]*)?(?:\b0)?([6-9]\d[\d\s-]{7,11}\d)\b/);
    if (pm && lines[i].replace(/\D/g, '').length >= 10 && lines[i].replace(/\D/g, '').length <= 13) { d.phone = pm[0].replace(/[^\d+]/g, ''); pi = i; break; }
  }
  // city/state line: "City, State" (state may be an abbreviation or name)
  var ci = -1;
  for (i = 0; i < lines.length; i++) {
    if (used[i] || i === pi) continue;
    var cm = lines[i].match(/^,?\s*([A-Za-z .]+?)\s*,\s*([A-Za-z .]+?)\s*(?:\(.*\))?$/);
    if (cm && lines[i].length < 50 && !/@|http/.test(lines[i]) && ci < 0) { d.city = cm[1]; d.state = cm[2]; ci = i; break; }
  }
  // name: closest sensible line above the city line, else above the phone line
  var anchor = ci >= 0 ? ci : pi;
  for (i = anchor - 1; i >= 0 && anchor >= 0; i--) {
    if (used[i] || i === pi) continue;
    if (lines[i].length <= 40 && !/[@:]|http|lead|indiamart|interested|dear|hello|^hi\b/i.test(lines[i]) && /^[A-Za-z][A-Za-z .'-]+$/.test(lines[i])) { d.name = lines[i].toLowerCase().replace(/(^|[ .'-])([a-z])/g, function (x, a, b) { return a + b.toUpperCase(); }); break; }
  }
  // product: line just above "Quantity"
  for (i = 0; i < lines.length; i++) {
    if (/^Quantity/i.test(lines[i])) {
      for (var j = i - 1; j >= 0; j--) { if (!used[j] || true) { if (j !== pi && j !== ci && lines[j] !== d.name && !/^(Application|Access|Buyer|Probable)/i.test(lines[j])) { d.product = lines[j].replace(/^(Requirement|Product|Looking for|Interested in)\s*[:\-]?\s*/i, ''); break; } } }
      break;
    }
  }
  return d;
}`
const SCRIPT = String.raw`// Hermora - IndiaMART lead intake. Paste this whole thing into Google Apps Script, then run "setup" once.
var URL_ = '@@URL@@';
var KEY_ = '@@KEY@@';
var SECRET_ = '@@SECRET@@';
var DONE_LABEL = 'Hermora-done';

@@PARSER@@

function call_(fn, body) {
  var r = UrlFetchApp.fetch(URL_ + '/rest/v1/rpc/' + fn, { method: 'post', contentType: 'application/json', headers: { apikey: KEY_, Authorization: 'Bearer ' + KEY_ }, payload: JSON.stringify(body), muteHttpExceptions: true });
  return { code: r.getResponseCode(), text: r.getContentText() };
}

function checkMail() {
  var label = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  var threads = GmailApp.search('indiamart newer_than:3d -label:' + DONE_LABEL, 0, 30);
  threads.forEach(function (t) {
    var ok = true;
    t.getMessages().forEach(function (m) {
      var subject = m.getSubject() || '';
      var body = m.getPlainBody() || '';
      var d = parseLead(body);
      d.cc = ((m.getCc() || '') + ',' + (m.getTo() || '')).match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
      var res;
      if (!d.phone && !d.name) res = call_('intake_unreadable', { p_secret: SECRET_, p_message_id: m.getId(), p_raw: subject + '\n\n' + body });
      else res = call_('intake_indiamart', { p_secret: SECRET_, p_message_id: m.getId(), p_data: d });
      if (res.code >= 300) ok = false;
      else if (res.text.indexOf('"paused"') > -1) ok = false;
    });
    if (ok) t.addLabel(label);
  });
}

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkMail').timeBased().everyMinutes(5).create();
  checkMail();
}
`
export function IndiaMartIntake({ me }: { me: any }) {
  const qc = useQueryClient(), s = useSettings(), [msg, setMsg] = useState('')
  const emps = useQuery({ queryKey: ['employees'], queryFn: async () => (await supabase.from('employees').select('*').order('created_at')).data ?? [] })
  const sec = useQuery({ queryKey: ['intake-secret'], queryFn: async () => (await supabase.rpc('intake_secret_for_admin')).data as string | null })
  const log = useQuery({ queryKey: ['intake-log'], refetchInterval: 30000, queryFn: async () => ((await supabase.rpc('intake_overview')).data ?? []) as any[] })
  const all = (s as any)
  const raw = useQuery({ queryKey: ['intake-settings'], queryFn: async () => Object.fromEntries(((await supabase.from('org_settings').select('key,value').in('key', ['indiamartAssignee', 'indiamartPaused'])).data ?? []).map((r: any) => [r.key, r.value])) as Record<string, any> })
  const assignee = raw.data?.indiamartAssignee ?? '', paused = raw.data?.indiamartPaused === true
  async function put(k: string, v: any) { const e = await saveSetting(k, v, me.id); setMsg(e ?? 'Saved.'); qc.invalidateQueries({ queryKey: ['intake-settings'] }) }
  async function copy() {
    const script = SCRIPT.replace('@@URL@@', () => String(import.meta.env.VITE_SUPABASE_URL).replace(/\s+/g, '')).replace('@@KEY@@', () => String(import.meta.env.VITE_SUPABASE_ANON_KEY).replace(/\s+/g, '')).replace('@@SECRET@@', () => (sec.data ?? '').replace(/\s+/g, '')).replace('@@PARSER@@', () => PARSER)
    try { await navigator.clipboard.writeText(script); setMsg('Script copied. Now paste it into Google Apps Script.') } catch { setMsg('Could not copy. Please try again.') }
  }
  void all
  const bad = (log.data ?? []).filter((x: any) => x.status === 'failed')
  return <div className="card"><h3 style={{ margin: 0 }}>IndiaMART leads from Gmail</h3>
    <p className="muted" style={{ margin: 0 }}>Each IndiaMART lead email in the company Gmail becomes an inquiry here, with the customer added, and the person is told at once. Employees in Cc of the email get the lead (taking turns if there are several); if none of them is found here, the person below gets it.</p>
    <label>Who receives a lead when nobody is in Cc
      <select value={assignee} onChange={(e) => put('indiamartAssignee', e.target.value)}>
        <option value="">Admin (default)</option>
        {(emps.data ?? []).filter((e: any) => e.active && e.role !== 'service_admin').map((e: any) => <option key={e.id} value={e.id}>{e.employee_name}</option>)}
      </select></label>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row', color: 'inherit', fontSize: 14 }}>
      <input type="checkbox" style={{ width: 18, height: 18, padding: 0 }} checked={paused} onChange={(e) => put('indiamartPaused', e.target.checked)} />Pause (stop creating inquiries from emails)</label>
    <button className="primary" onClick={copy} disabled={!sec.data}>Copy the Gmail script</button>
    {msg && <p className="msg">{msg}</p>}
    {bad.length > 0 && <div className="warnbox"><b>Needs checking ({bad.length})</b>{bad.slice(0, 5).map((x: any) => <div key={x.id} className="muted">{new Date(x.at).toLocaleString()} · {x.error}</div>)}</div>}
    <div className="muted">Recent leads:</div>
    {(log.data ?? []).filter((x: any) => x.status === 'created').slice(0, 8).map((x: any) => <div className="row" key={x.id}><span>{x.summary}</span><span className="muted">{new Date(x.at).toLocaleString()}</span></div>)}
    {!(log.data ?? []).some((x: any) => x.status === 'created') && <p className="empty">No leads received yet.</p>}
  </div>
}
