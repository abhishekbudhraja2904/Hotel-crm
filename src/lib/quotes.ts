export const QSTATUS = ['Sent', 'Revised', 'Accepted', 'Rejected']
export const qclass = (s: string) => (s === 'Accepted' ? 'Low' : s === 'Rejected' ? 'Urgent' : s === 'Revised' ? 'High' : s === 'Sent' ? 'Medium' : '')
export const one = (x: any) => (Array.isArray(x) ? x[0] : x)
