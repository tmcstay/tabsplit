'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface ItemInput {
  description: string
  price: number
}

export async function saveItems(
  splitId: string,
  items: ItemInput[],
  total?: number | null
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('items').insert(
    items.map((item, i) => ({
      split_id: splitId,
      description: item.description,
      price: item.price,
      sort_order: i,
    }))
  )
  if (error) throw new Error('Failed to save items.')

  const updatePayload: Record<string, unknown> = { status: 'draft' }
  if (total != null) updatePayload.total = total
  await supabase.from('splits').update(updatePayload).eq('id', splitId)
}

export async function assignItem(
  itemId: string,
  attendeeIds: string[]
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('item_assignments').delete().eq('item_id', itemId)

  if (attendeeIds.length > 0) {
    const { error } = await supabase.from('item_assignments').insert(
      attendeeIds.map(attendeeId => ({ item_id: itemId, attendee_id: attendeeId }))
    )
    if (error) throw new Error('Failed to assign item.')
  }
}

export async function mergeAttendees(
  splitId: string,
  attendeeIds: string[],
  label: string
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: group, error: groupErr } = await supabase
    .from('attendee_groups')
    .insert({ split_id: splitId, label })
    .select()
    .single()

  if (groupErr || !group) throw new Error('Failed to create group.')

  const { error } = await supabase
    .from('attendees')
    .update({ group_id: group.id })
    .in('id', attendeeIds)

  if (error) throw new Error('Failed to merge attendees.')
}

export async function finaliseSplit(splitId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const token = crypto.randomUUID()

  const [{ error: statusErr }, { error: linkErr }] = await Promise.all([
    supabase
      .from('splits')
      .update({ status: 'finalised' })
      .eq('id', splitId)
      .eq('organiser_id', user.id),
    supabase.from('share_links').insert({ split_id: splitId, token }),
  ])

  if (statusErr || linkErr) throw new Error('Failed to finalise split.')
}

export async function equalSplit(splitId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: items }, { data: attendees }] = await Promise.all([
    supabase.from('items').select('id').eq('split_id', splitId),
    supabase.from('attendees').select('id').eq('split_id', splitId),
  ])

  if (!items?.length || !attendees?.length) return

  await supabase.from('item_assignments').delete().in('item_id', items.map(i => i.id))

  await supabase.from('item_assignments').insert(
    items.flatMap(item => attendees.map(a => ({ item_id: item.id, attendee_id: a.id })))
  )
}
