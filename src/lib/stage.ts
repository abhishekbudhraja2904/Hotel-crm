import { supabase } from './supabase'
// Moves an inquiry stage; refuses if someone else edited it since it was loaded. Returns an error message or null.
export async function moveStage(r: { id: string; updated_at: string }, next: string): Promise<string | null> {
  const { data, error } = await supabase.from('inquiries').update({ sales_stage: next }).eq('id', r.id).eq('updated_at', r.updated_at).select('id')
  if (error) return error.message
  if (!data?.length) return 'Someone else changed this inquiry. Latest data loaded — try again.'
  if (next === 'Order Confirmed' || next === 'Lost')
    await supabase.from('followups').update({ status: 'Cancelled' }).eq('inquiry_id', r.id).eq('status', 'Pending')
  return null
}
