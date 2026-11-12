import { supabase } from './supabase'
import { APP_NAME } from './brand'
import { fmtDate, isoDate, weekOf, isThisWeek } from './dates'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
// Reads every page of a query (the database returns at most 1000 rows at a time).
async function all(build: () => any): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999); if (error) throw error
    out.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  return out
}
const wk = (d: any) => ({ 'Week of': weekOf(d), 'This week': isThisWeek(d) ? 'Yes' : 'No' })
const items = (r: any[] | null | undefined, price = false) => (r ?? []).map((i: any) => `${Number(i.quantity ?? 0)}${i.unit ? ' ' + i.unit : ''} × ${i.product_name_snapshot ?? i.product_name}${price ? ` @ ${Number(i.unit_price)}` : ''}`).join('; ')
// One Excel file with everything the person is allowed to see, full history every time. Sales get only their own data (the database already limits it).
export async function exportAll(me: any): Promise<string> {
  const XLSX = await import('xlsx')
  const inq = await all(() => supabase.from('inquiries').select('id,inquiry_number,inquiry_source,priority,sales_stage,created_at,updated_at,inquiry_title,lost_reason,packing_no,dispatched_at,customers(customer_name,phone_number),assigned:employees!assigned_to(employee_name),inquiry_items(product_name_snapshot,quantity,unit)').is('archived_at', null).order('created_at', { ascending: false }))
  const cus = await all(() => supabase.from('customers').select('customer_name,phone_number,created_at').order('created_at', { ascending: false }))
  const quo = await all(() => supabase.from('quotations').select('quotation_number,version,quotation_date,status,created_at,creator:created_by(employee_name),inquiries(inquiry_number,customers(customer_name)),quotation_lines(product_name,quantity,unit)').order('created_at', { ascending: false }))
  const fin = await all(() => supabase.from('order_finance').select('inquiry_id,pay_status,balance_due_on,pay_later'))
  const byInq: Record<string, any> = Object.fromEntries(inq.map((r) => [r.id, r]))
  const finBy: Record<string, any> = Object.fromEntries(fin.map((f) => [f.inquiry_id, f]))
  const sheets: [string, any[]][] = []
  sheets.push(['Inquiries', inq.map((r) => ({ 'Date': fmtDate(r.created_at), ...wk(r.created_at), 'Inquiry no.': r.inquiry_number, 'Customer': one(r.customers)?.customer_name ?? '', 'Phone': one(r.customers)?.phone_number ?? '', 'Stage': r.sales_stage, 'Priority': r.priority, 'Source': r.inquiry_source ?? '', 'Assigned to': one(r.assigned)?.employee_name ?? '', 'Items': items(r.inquiry_items), 'Title / notes': r.inquiry_title ?? '', 'Lost reason': r.lost_reason ?? '', 'Last updated': fmtDate(r.updated_at) }))])
  sheets.push(['Customers', cus.map((c) => ({ 'Added on': fmtDate(c.created_at), ...wk(c.created_at), 'Customer': c.customer_name, 'Phone': c.phone_number ?? '' }))])
  sheets.push(['Quotations', quo.map((q) => ({ 'Date': fmtDate(q.quotation_date), ...wk(q.quotation_date), 'Quotation no.': q.quotation_number, 'Version': q.version, 'Inquiry no.': one(q.inquiries)?.inquiry_number ?? '', 'Customer': one(one(q.inquiries)?.customers)?.customer_name ?? '', 'Items and quantities': items(q.quotation_lines), 'Status': q.status, 'Quoted by': one(q.creator)?.employee_name ?? '' }))])
  sheets.push(['Orders', inq.filter((r) => r.sales_stage === 'Order Confirmed').map((r) => { const f = finBy[r.id]
    return { 'Last updated': fmtDate(r.updated_at), ...wk(r.updated_at), 'Inquiry no.': r.inquiry_number, 'Packing no.': r.packing_no ?? '', 'Customer': one(r.customers)?.customer_name ?? '', 'Phone': one(r.customers)?.phone_number ?? '', 'Items': items(r.inquiry_items),
      'Payment': f?.pay_status ?? 'Not paid', 'Payment later': f?.pay_later ? 'Yes' : '', 'Payment promised by': fmtDate(f?.balance_due_on), 'Dispatched': r.dispatched_at ? 'Yes' : 'No' } })])
  if (me.role === 'admin') { // the owner only
    const st = await supabase.rpc('stock_overview'); if (st.error) throw st.error
    sheets.push(['Products and stock', (st.data as any[]).map((s) => ({ 'Product': s.product_name, 'Code': s.product_code ?? '', 'Category': s.product_category, 'Unit': s.unit, 'In store': Number(s.in_store), 'Locked for orders': Number(s.locked), 'Free': Number(s.free), 'Low-stock alert at': Number(s.low_stock_level) }))])
  }
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No records yet' }])
    const keys = Object.keys(rows[0] ?? { Note: '' }); ws['!cols'] = keys.map((k) => ({ wch: Math.min(60, Math.max(k.length + 2, ...rows.slice(0, 200).map((r) => String(r[k] ?? '').length + 2))) }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  const file = `${APP_NAME}-data-${isoDate()}.xlsx`
  XLSX.writeFile(wb, file)
  return file
}
// Weekly auto download: remembered ONLY in this device's browser, so each laptop/phone decides for itself.
const K_ON = 'hermora.autoDownload', K_LAST = 'hermora.lastDownload'
export const autoOn = () => { try { return localStorage.getItem(K_ON) === '1' } catch { return false } }
export const setAutoOn = (v: boolean) => { try { v ? localStorage.setItem(K_ON, '1') : localStorage.removeItem(K_ON) } catch {} }
export const lastDownload = () => { try { return localStorage.getItem(K_LAST) } catch { return null } }
export const markDownloaded = () => { try { localStorage.setItem(K_LAST, new Date().toISOString()) } catch {} }
export async function maybeAutoDownload(me: any) {
  if (!autoOn() || !['admin', 'sales'].includes(me.role)) return
  const last = lastDownload(); if (last && Date.now() - +new Date(last) < 7 * 864e5) return
  try { await exportAll(me); markDownloaded() } catch {}
}
