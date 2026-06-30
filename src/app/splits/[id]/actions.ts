'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { generateId } from '@/lib/uuid'

interface ItemInput {
  description: string
  price: number
}

export async function saveItems(
  splitId: string,
  items: ItemInput[],
  total?: number | null,
  subtotal?: number | null,
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

  const updatePayload: { status: 'draft'; total?: number; subtotal?: number } = { status: 'draft' }
  if (total != null) updatePayload.total = total
  if (subtotal != null) updatePayload.subtotal = subtotal
  await supabase.from('splits').update(updatePayload).eq('id', splitId)
}

export async function assignItem(
  itemId: string,
  attendeeIds: string[]
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error: deleteError } = await supabase.from('item_assignments').delete().eq('item_id', itemId)
  if (deleteError) throw new Error('Failed to clear existing assignment.')

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
  label: string,
  phone: string | null,
  email: string | null,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: group, error: groupErr } = await supabase
    .from('attendee_groups')
    .insert({ split_id: splitId, label, phone, email })
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

  const token = generateId()

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

export async function addLineItem(
  splitId: string,
  description: string,
  price: number,
  // null = assign to all attendees, [] = leave unassigned, [...ids] = assign to specific attendees
  attendeeIds: string[] | null,
  sortOrder: number,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: item, error } = await supabase
    .from('items')
    .insert({ split_id: splitId, description, price, sort_order: sortOrder })
    .select()
    .single()

  if (error || !item) throw new Error('Failed to add line item.')

  let ids = attendeeIds
  if (ids === null) {
    const { data: atts } = await supabase.from('attendees').select('id').eq('split_id', splitId)
    ids = atts?.map(a => a.id) ?? []
  }

  if (ids.length > 0) {
    await supabase.from('item_assignments').insert(
      ids.map(aId => ({ item_id: item.id, attendee_id: aId }))
    )
  }
}

export async function unfinaliseSplit(splitId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await Promise.all([
    supabase
      .from('splits')
      .update({ status: 'draft' })
      .eq('id', splitId)
      .eq('organiser_id', user.id),
    supabase.from('share_links').delete().eq('split_id', splitId),
  ])
}

export async function applyDiscount(
  splitId: string,
  type: 'flat' | 'percentage',
  value: number,
  attendeeIds: string[]
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: discount, error } = await supabase
    .from('discounts')
    .insert({ split_id: splitId, type, value })
    .select()
    .single()

  if (error || !discount) throw new Error('Failed to create discount.')

  if (attendeeIds.length > 0) {
    const { error: joinErr } = await supabase
      .from('discount_attendees')
      .insert(attendeeIds.map(attendee_id => ({ discount_id: discount.id, attendee_id })))
    if (joinErr) throw new Error('Failed to assign discount to attendees.')
  }
}

export async function removeDiscount(discountId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('discounts').delete().eq('id', discountId)
}

export async function updateAttendee(
  attendeeId: string,
  data: { display_name: string; phone: string | null; email: string | null }
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('attendees')
    .update(data)
    .eq('id', attendeeId)

  if (error) throw new Error('Failed to update attendee.')
}

export async function unmergeGroup(groupId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('attendees').update({ group_id: null }).eq('group_id', groupId)
  await supabase.from('attendee_groups').delete().eq('id', groupId)
}

export async function markPaid(
  splitId: string,
  entityId: string,
  paid: boolean,
  isGroup: boolean,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (isGroup) {
    const { data: members } = await supabase
      .from('attendees')
      .select('id')
      .eq('split_id', splitId)
      .eq('group_id', entityId)
    if (members?.length) {
      await supabase
        .from('attendees')
        .update({ paid })
        .in('id', members.map(m => m.id))
    }
  } else {
    await supabase
      .from('attendees')
      .update({ paid })
      .eq('id', entityId)
      .eq('split_id', splitId)
  }
}

export async function updateLineItem(
  itemId: string,
  description: string,
  price: number,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('items')
    .update({ description, price })
    .eq('id', itemId)

  if (error) throw new Error('Failed to update item.')
}

export async function deleteLineItem(itemId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('item_assignments').delete().eq('item_id', itemId)

  const { error } = await supabase.from('items').delete().eq('id', itemId)
  if (error) throw new Error('Failed to delete item.')
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
