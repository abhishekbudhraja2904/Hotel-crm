import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSettings, saveSetting } from '../lib/settings'
// Admin-only: connects the company Gmail to Hermora so IndiaMART lead emails become inquiries automatically.
const PARSER = String.raw`function parseLead(text) {
  text = text.replace(/\r/g, '');
  // Skip the forwarder's own signature: read only the forwarded IndiaMART message.
  var fm = text.search(/-{3,}\s*Forwarded message\s*-{3,}/i); if (fm >= 0) text = text.slice(fm);
  var a = text.search(/Buyer.?s Contact Details/i); if (a >= 0) text = text.slice(a);
  var z = text.search(/Reply To This Message/i); if (z > 0) text = text.slice(0, z);
  var d = {}, tail = '';
  // Layout 2: the buyer is written under "Regards" at the bottom.
  var rg = -1, re = /(^|\n)\s*Regards,?\s*\n/gi, mm;
  while ((mm = re.exec(text))) rg = mm.index + mm[0].length;
  if (rg >= 0) { tail = text.slice(rg); text = text.slice(0, rg); }
  var lines = text.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(function (l) { return l && l !== ':'; });
  var labels = { quantity: 'quantity', application: 'application', 'access method': 'access_method', 'buyer filled details': 'buyer_filled', 'probable order value': 'order_value', 'probable requirement type': 'requirement_type', email: 'email', company: 'company' };
  var used = {}, extra = [];
  var skipKeys = /^(from|to|cc|date|subject|sent|mobile|phone|email|products? of interest|requirements? till now|member since)$/i;
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/^(Quantity|Application|Access Method|Buyer Filled Details|Probable Order Value|Probable Requirement Type|Email|Company)\s*[:\-]?\s*(.*)$/i);
    if (m) {
      var key = labels[m[1].toLowerCase()], val = m[2].replace(/^:\s*/, '');
      if (!val && lines[i + 1] && !/^(Quantity|Application|Access Method|Buyer Filled|Probable)/i.test(lines[i + 1])) { val = lines[i + 1]; used[i + 1] = 1; }
      if (val && !d[key]) d[key] = val;
      used[i] = 1;
      continue;
    }
    // any other "Label : value" row of the requirement table (Door Type, Door Material ...)
    var kv = lines[i].match(/^([A-Za-z][A-Za-z \/]{2,40}?)\s*:\s*(\S.*)$/);
    if (kv && !skipKeys.test(kv[1].trim()) && !/^below are/i.test(kv[1]) && lines[i].length < 120) { extra.push(kv[1].trim() + ': ' + kv[2].trim()); used[i] = 1; }
  }
  if (extra.length) d.extra = extra.join('; ');
  var one = text.replace(/\s+/g, ' ');
  var sf = one.match(/searching for (.+?)\.(?: |$)/i); if (sf) d.product = sf[1].trim();
  if (tail) {
    var tl = tail.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(function (l) { return l; });
    if (tl[0] && /^[A-Za-z][A-Za-z .'-]+$/.test(tl[0]) && tl[0].length <= 50) d.name = tl[0];
    if (tl[1] && tl[1].indexOf(',') > 0 && !/:/.test(tl[1])) {
      var parts = tl[1].split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
      if (parts.length && /^india$/i.test(parts[parts.length - 1])) parts.pop();
      if (parts.length >= 3) { d.company = parts[0]; d.city = parts[parts.length - 2]; d.state = parts[parts.length - 1]; }
      else if (parts.length === 2) { d.city = parts[0]; d.state = parts[1]; }
    }
    var tm = tail.match(/Mobile\s*:?\s*([+\d][\d\s-]{8,})/i); if (tm) d.phone = tm[1].replace(/[^\d+]/g, '');
    var te = tail.match(/Email\s*:?\s*([A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i); if (te) d.email = te[1];
  } else {
    // Layout 1: name, "City, State" and phone sit above the requirement details.
    var pi = -1, ci = -1;
    for (i = 0; i < lines.length; i++) {
      if (used[i]) continue;
      var pm = lines[i].match(/(?:\+\s*91[\s-]*)?(?:\b0)?([6-9]\d[\d\s-]{7,11}\d)\b/);
      if (pm && lines[i].replace(/\D/g, '').length >= 10 && lines[i].replace(/\D/g, '').length <= 13) { d.phone = pm[0].replace(/[^\d+]/g, ''); pi = i; break; }
    }
    for (i = 0; i < lines.length; i++) {
      if (used[i] || i === pi) continue;
      var cm = lines[i].match(/^,?\s*([A-Za-z .]+?)\s*,\s*([A-Za-z .]+?)\s*(?:\(.*\))?$/);
      if (cm && lines[i].length < 50 && !/@|http/.test(lines[i])) { d.city = cm[1]; d.state = cm[2]; ci = i; break; }
    }
    var anchor = ci >= 0 ? ci : pi;
    for (i = anchor - 1; i >= 0 && anchor >= 0; i--) {
      if (used[i] || i === pi) continue;
      if (lines[i].length <= 40 && !/[@:]|http|lead|indiamart|interested|dear|hello|^hi\b/i.test(lines[i]) && /^[A-Za-z][A-Za-z .'-]+$/.test(lines[i])) { d.name = lines[i]; break; }
    }
  }
  if (d.name) d.name = d.name.toLowerCase().replace(/(^|[ .'-])([a-z])/g, function (x, p, c) { return p + c.toUpperCase(); });
  if (!d.product) {
    for (i = 0; i < lines.length; i++) {
      if (/^Quantity/i.test(lines[i])) {
        for (var j = i - 1; j >= 0; j--) { if (lines[j] !== d.phone && !/^(Below|Application|Access|Buyer|Probable|Phone|Member|Buylead)/i.test(lines[j]) && lines[j].indexOf(d.city || '\u0001') < 0 && lines[j] !== d.name) { d.product = lines[j].replace(/^(Requirement|Product|Looking for|Interested in)\s*[:\-]?\s*/i, '').trim(); break; } }
        break;
      }
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

// Contact details written in blue (clickable phone numbers and email addresses) inside the IndiaMART part of the email.
function blueContacts_(html) {
  var cut = html.search(/Forwarded message/i); if (cut >= 0) html = html.slice(cut);
  var end = html.search(/Reply To This Message|If you would like to unsubscribe|IndiaMART InterMESH/i); if (end > 0) html = html.slice(0, end);
  var texts = [], m;
  var isBlue = function (c) {
    c = (c || '').toLowerCase().replace(/\s/g, ''); var r, g, b, h;
    if ((h = c.match(/^#([0-9a-f]{6})$/))) { r = parseInt(h[1].substr(0, 2), 16); g = parseInt(h[1].substr(2, 2), 16); b = parseInt(h[1].substr(4, 2), 16); }
    else if ((h = c.match(/^#([0-9a-f]{3})$/))) { r = parseInt(h[1][0] + h[1][0], 16); g = parseInt(h[1][1] + h[1][1], 16); b = parseInt(h[1][2] + h[1][2], 16); }
    else if ((h = c.match(/^rgba?\((\d+),(\d+),(\d+)/))) { r = +h[1]; g = +h[2]; b = +h[3]; }
    else return c === 'blue' || c === 'mediumblue' || c === 'royalblue';
    return b > 120 && b > r + 50 && b > g + 20;
  };
  var strip = function (s) { return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); };
  // 1) tel: and mailto: links
  var re1 = /<a\b[^>]*href=["'](tel|mailto):([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = re1.exec(html))) texts.push(decodeURIComponent(m[2]) + ' ' + strip(m[3]));
  // 2) any link or text written in a blue colour
  var re2 = /<(a|span|font|b|strong|td|p|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = re2.exec(html))) {
    var at = m[1].toLowerCase() === 'font' ? (m[2].match(/color=["']([^"']+)["']/i) || []) : (m[2].match(/style=["'][^"']*?(?:^|;|\s)color\s*:\s*([^;"']+)/i) || []);
    if (at[1] && isBlue(at[1])) texts.push(strip(m[3]));
  }
  var phones = [], emails = [];
  texts.forEach(function (t) {
    (t.match(/(?:\+\s*91[\s-]*)?\(?0?[6-9]\d[\d\s-]{7,12}\d/g) || []).forEach(function (p) {
      var dg = p.replace(/\D/g, ''); if (dg.length < 10 || dg.length > 13) return;
      var last = dg.slice(-10); if (last === '9696969696' || /^1800/.test(dg)) return;
      var n = (dg.length === 10 ? '+91' : '+') + dg; if (phones.indexOf(n) < 0) phones.push(n);
    });
    (t.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).forEach(function (e) { if (!/indiamart\.com$/i.test(e) && emails.indexOf(e) < 0) emails.push(e); });
  });
  return { phones: phones, emails: emails };
}

var OWN_NUMBERS_ = ['9312435438', '9711482220']; // OFORT's own phone numbers, never taken as the buyer's

function htmlToText_(html) {
  return html.replace(/<(br|\/p|\/div|\/tr|\/li|\/h\d|\/table)[^>]*>/gi, '\n').replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ');
}

// The IndiaMART part of an email: after "Forwarded message", before the IndiaMART footer.
function section_(text) {
  var fm = text.search(/-{3,}\s*Forwarded message\s*-{3,}/i); if (fm >= 0) text = text.slice(fm);
  var z = text.search(/Reply To This Message|If you would like to unsubscribe/i); if (z > 0) text = text.slice(0, z);
  return text;
}

// Last-resort search: the first Indian mobile number in the IndiaMART part (not ours, not a toll-free line).
function anyPhone_(text) {
  var found = null;
  (text.match(/(?:\+\s*91[\s-]*)?\(?0?[6-9]\d[\d\s-]{7,12}\d/g) || []).forEach(function (p) {
    if (found) return;
    var dg = p.replace(/\D/g, ''); if (dg.length < 10 || dg.length > 13) return;
    var last = dg.slice(-10); if (OWN_NUMBERS_.indexOf(last) >= 0 || last === '9696969696' || /^1800/.test(dg)) return;
    found = (dg.length === 10 ? '+91' : '+') + dg;
  });
  return found;
}

// Reads any IndiaMART email, whatever its layout. Never throws; returns null only when it is clearly not a lead.
function buildLead_(subject, plain, html) {
  var text = plain || '';
  if (text.replace(/\s/g, '').length < 80 && html) text = htmlToText_(html);
  var d = {};
  try { d = parseLead(text) || {}; } catch (e) { d = {}; }
  try { var bc = blueContacts_(html || ''); if (bc.phones.length) d.phone = bc.phones[0]; if (bc.emails.length) d.email = bc.emails[0]; } catch (e) {}
  if (d.phone && OWN_NUMBERS_.indexOf(String(d.phone).replace(/\D/g, '').slice(-10)) >= 0) delete d.phone;
  if (d.product && /^[\d\s+()-]{8,}$/.test(d.product)) delete d.product;
  var sec = section_(text);
  if (!d.phone) { var ap = anyPhone_(sec); if (ap) d.phone = ap; }
  if (!d.phone && html) { var ah = anyPhone_(section_(htmlToText_(html))); if (ah) d.phone = ah; }
  if (!d.product) { var sj = (subject || '').replace(/^\s*((fwd?|re)\s*:\s*)+/i, '').replace(/buyer details for/i, '').replace(/\s+/g, ' ').trim(); if (sj) d.product = sj.slice(0, 80); }
  if (!d.phone && !d.name) {
    if (!/buyer|enquir|inquir|buy ?lead|requirement|contact details|interested in|quantity/i.test(sec + ' ' + subject)) return null;
    d.name = 'IndiaMART lead (check email)';
  }
  if (d.name === 'IndiaMART lead (check email)' || !d.phone) d.extra = ((d.extra ? d.extra + '; ' : '') + 'Original email: ' + sec.replace(/\s+/g, ' ').slice(0, 700)).slice(0, 900);
  return d;
}

function call_(fn, body) {
  var r = UrlFetchApp.fetch(URL_ + '/rest/v1/rpc/' + fn, { method: 'post', contentType: 'application/json', headers: { apikey: KEY_, Authorization: 'Bearer ' + KEY_ }, payload: JSON.stringify(body), muteHttpExceptions: true });
  return { code: r.getResponseCode(), text: r.getContentText() };
}

function checkMail() {
  var label = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  var threads = GmailApp.search('indiamart newer_than:10d -label:' + DONE_LABEL, 0, 50);
  threads.forEach(function (t) {
    var ok = true;
    t.getMessages().forEach(function (m) {
      var subject = m.getSubject() || '';
      var body = m.getPlainBody() || '';
      var d = buildLead_(subject, body, m.getBody() || '');
      if (d) d.cc = ((m.getCc() || '') + ',' + (m.getTo() || '')).match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
      var res;
      if (!d) res = call_('intake_unreadable', { p_secret: SECRET_, p_message_id: m.getId(), p_raw: subject + '\n\n' + body });
      else res = call_('intake_indiamart', { p_secret: SECRET_, p_message_id: m.getId(), p_data: d });
      if (res.code >= 300) ok = false;
      else if (res.text.indexOf('"paused"') > -1) ok = false;
    });
    if (ok) t.addLabel(label);
  });
}

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkMail').timeBased().everyMinutes(1).create();
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
