import HI from './i18n-hi'
// Language switch (English / Hindi). The app is written in English; in Hindi mode every piece of text on screen that matches the
// dictionary is replaced as it appears. Anything not in the dictionary (names, notes, new wording) simply stays in English.
export type Lang = 'en' | 'hi'
const KEY = 'hermora-lang'
export const getLang = (): Lang => { try { return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en' } catch { return 'en' } }
export function setLang(l: Lang) { try { localStorage.setItem(KEY, l) } catch { /* ignore */ } window.location.reload() }

const num = (s: string) => s
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Assigned by (.+?) · Packing: (.+)$/, (m) => `किसने दिया: ${m[1]} · पैकिंग: ${m[2]}`],
  [/^Assigned by (.+)$/, (m) => `किसने दिया: ${m[1]}`],
  [/^Given to (.+) · planned (.+)$/, (m) => `दिया: ${m[1]} · तय तारीख ${m[2]}`],
  [/^Completed (\S+) by (.+) · warranty until (.+)$/, (m) => `पूरा हुआ ${m[1]}, ${m[2]} द्वारा · वारंटी ${m[3]} तक`],
  [/^Opened (.+)$/, (m) => `खोला गया ${m[1]}`],
  [/^(\d+) more waiting in the bell$/, (m) => `${m[1]} और घंटी में इंतज़ार में`],
  [/^(\d+) more waiting$/, (m) => `${m[1]} और इंतज़ार में`],
  [/^Orders to pack and collect \((\d+)\)$/, (m) => `पैक करने और ले जाने के ऑर्डर (${m[1]})`],
  [/^Payment received in full: packing no\. (.+)$/, (m) => `पूरा पेमेंट मिल गया: पैकिंग नं. ${m[1]}`],
  [/^New packing work: packing no\. (.+)$/, (m) => `नया पैकिंग काम: पैकिंग नं. ${m[1]}`],
  [/^Packed and paid: collect packing no\. (.+)$/, (m) => `पैक और पेमेंट पूरा: पैकिंग नं. ${m[1]} ले जाएं`],
  [/^New installation work: (.+)$/, (m) => `नया इंस्टॉलेशन काम: ${m[1]}`],
  [/^New service ticket (S-\d+): (.+)$/, (m) => `नया सर्विस टिकट ${m[1]}: ${m[2]}`],
  [/^Payment received in full$/, () => 'पूरा पेमेंट मिल गया'],
  [/^Delete (.+)\?$/, (m) => `${m[1]} को हटाएं?`],
  [/^\+ GST \((.+)%\)$/, (m) => `+ GST (${m[1]}%)`],
  [/^Good (morning|afternoon|evening), (.+)$/, (m) => `${m[1] === 'morning' ? 'सुप्रभात' : m[1] === 'afternoon' ? 'नमस्कार' : 'शुभ संध्या'}, ${m[2]}`],
]
function tr(s: string): string | null {
  const t = s.trim(); if (!t) return null
  const d = HI[t]; if (d) return num(d)
  for (const [re, f] of PATTERNS) { const m = t.match(re); if (m) return f(m) }
  return null
}
const hindiOf = new WeakMap<Node, string>()
function text(n: Text) {
  const cur = n.nodeValue ?? ''
  if (hindiOf.get(n) === cur) return
  const h = tr(cur); if (h === null) { hindiOf.delete(n); return }
  const lead = cur.match(/^\s*/)![0], trail = cur.match(/\s*$/)![0], out = lead + h + trail
  hindiOf.set(n, out); n.nodeValue = out
}
const ATTRS = ['placeholder', 'aria-label', 'title']
function attrs(el: Element) {
  for (const a of ATTRS) { const v = el.getAttribute(a); if (!v) continue; const h = tr(v); if (h !== null && h !== v) el.setAttribute(a, h) }
}
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT'])
function walk(node: Node) {
  if (node.nodeType === 3) { if (!SKIP.has((node.parentElement?.tagName) ?? '')) text(node as Text); return }
  if (node.nodeType !== 1) return
  const el = node as Element
  if (SKIP.has(el.tagName) || el.closest('[data-no-translate]')) return
  attrs(el)
  for (const c of Array.from(el.childNodes)) walk(c)
}
export function initLang() {
  const l = getLang(); document.documentElement.lang = l
  if (l !== 'hi') return
  const run = () => {
    walk(document.body)
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(walk)
        else if (m.type === 'characterData') { if (m.target.parentElement && !SKIP.has(m.target.parentElement.tagName)) text(m.target as Text) }
        else if (m.type === 'attributes') attrs(m.target as Element)
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS })
  }
  if (document.body) run(); else document.addEventListener('DOMContentLoaded', run)
}
